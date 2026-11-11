package ru.teacherbox.meetings.livekit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.teacherbox.meetings.application.CallServer.Grant;
import ru.teacherbox.meetings.application.CallServer.Participant;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.meetings.application.MeetingsProperties;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.State;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** The adapter against an imitation of the Twirp API of LiveKit (JSON bodies). */
class LiveKitCallServerTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String SECRET = "0123456789abcdef0123456789abcdef";
    private static final Instant NOW = Instant.parse("2026-11-11T10:00:00Z");
    private static final String ROOM_A = "tb-00000000-0000-7000-8000-00000000000a";
    private static final String ROOM_GONE = "tb-00000000-0000-7000-8000-00000000000b";
    /** Someone joined, but ListRooms still counts nobody. */
    private static final String ROOM_STALE = "tb-00000000-0000-7000-8000-00000000000c";

    private HttpServer stub;
    private final List<String> calls = new ArrayList<>();
    private final List<Recorded> requests = new ArrayList<>();
    private int status = 200;
    private int removeStatus = 200;
    private List<String> rooms = List.of(ROOM_A, "tb-x", "other", ROOM_GONE, ROOM_STALE);

    /** What the server got: the path, the headers we look at and the JSON body. */
    private record Recorded(String method, String path, String contentType, String authorization, JsonNode body) {
    }

    @BeforeEach
    void start() throws IOException {
        stub = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        stub.createContext("/twirp/livekit.RoomService/", this::answer);
        stub.start();
    }

    @AfterEach
    void stop() {
        stub.stop(0);
    }

    @Test
    void readsOnlyOccupiedRoomsOfThePortal() {
        Map<String, List<Participant>> occupied = server(url()).occupiedRooms();

        assertThat(occupied).containsOnlyKeys(ROOM_A, ROOM_STALE);
        assertThat(occupied.get(ROOM_A)).containsExactly(new Participant("u-1", "Анна"),
                new Participant("u-2", "Борис"));
        assertThat(calls).containsExactly("ListRooms", "ListParticipants " + ROOM_A, "ListParticipants " + ROOM_GONE,
                "ListParticipants " + ROOM_STALE);
        assertThat(new LiveKitIntegrationCheck(server(url())).check().getFirst()).satisfies(result -> {
            assertThat(result.state()).isEqualTo(State.OK);
            assertThat(result.detail()).isEqualTo("Идёт звонков: 2");
        });
    }

    @Test
    void readsAnAnswerWithoutRooms() {
        rooms = List.of();
        assertThat(server(url()).occupiedRooms()).isEmpty();
        assertThat(calls).containsExactly("ListRooms");
    }

    @Test
    void reportsAWrongKeyAndAnUnreachableServer() {
        status = 401;
        assertThatThrownBy(() -> server(url()).occupiedRooms()).isInstanceOf(CallServerException.class)
                .hasMessage("LiveKit ListRooms answered 401 (wrong API key or secret)");
        assertThat(new LiveKitIntegrationCheck(server(url())).check().getFirst().state()).isEqualTo(State.FAILED);

        status = 500;
        assertThatThrownBy(() -> server(url()).occupiedRooms()).hasMessage("LiveKit ListRooms answered 500");
        status = 404;
        assertThatThrownBy(() -> server(url()).occupiedRooms()).hasMessage("LiveKit ListRooms answered 404");

        String closed = url();
        stub.stop(0);
        assertThatThrownBy(() -> server(closed).occupiedRooms()).isInstanceOf(CallServerException.class)
                .hasMessageStartingWith("LiveKit ListRooms: ");
    }

    @Test
    void removesAParticipantAndIgnoresOneThatLeft() {
        server(url()).removeParticipant("tb-a", "u-1");
        removeStatus = 404;
        server(url()).removeParticipant("tb-a", "u-2");
        assertThat(calls).containsExactly("RemoveParticipant tb-a u-1", "RemoveParticipant tb-a u-2");

        removeStatus = 503;
        assertThatThrownBy(() -> server(url()).removeParticipant("tb-a", "u-3"))
                .hasMessage("LiveKit RemoveParticipant answered 503");
    }

    @Test
    void signsATokenForOneRoom() {
        String student = server(url()).token(new Grant("tb-a", "u-1", "Анна", false));
        String teacher = server(url()).token(new Grant("tb-a", "t-1", "Ольга", true));

        assertThat(claims(student).toString()).contains("\"sub\":\"u-1\"", "\"name\":\"Анна\"", "\"room\":\"tb-a\"",
                "\"roomJoin\":true", "\"iss\":\"key\"", "screen_share", "\"roomAdmin\":false");
        assertThat(claims(teacher).path("video").path("roomAdmin").asBoolean()).isTrue();
        assertThat(calls).as("signed locally").isEmpty();
    }

    /** The tokens are what {@code io.livekit:livekit-server} 0.16.0 signed (captured once, ADR-0060). */
    @Test
    void signsTheTokensTheSdkSigned() throws IOException {
        JsonNode sdk = fixture();
        assertSameToken(server(url()).token(new Grant("tb-a", "u-1", "Анна", false)), sdk.path("studentToken"));
        assertSameToken(server(url()).token(new Grant("tb-a", "t-1", "Ольга", true)), sdk.path("teacherToken"));
    }

    /**
     * The room service gets what the SDK sent: the same paths, grants and fields. Two differences
     * are deliberate: the bodies are JSON (the SDK sent protobuf; Twirp takes both), and a token for
     * a call lives {@link LiveKitCallServer#TOKEN_TTL} instead of the SDK's six hours.
     */
    @Test
    void sendsTheRequestsTheSdkSent() throws IOException {
        JsonNode sdk = fixture();
        rooms = List.of(ROOM_A);
        server(url()).occupiedRooms();
        server(url()).removeParticipant(ROOM_A, "u-1");

        JsonNode expected = sdk.path("requests");
        assertThat(requests).hasSize(expected.size());
        for (int i = 0; i < requests.size(); i++) {
            Recorded actual = requests.get(i);
            JsonNode request = expected.get(i);
            assertThat(actual.method()).isEqualTo(request.path("method").asString());
            assertThat(actual.path()).isEqualTo(request.path("path").asString());
            assertThat(request.path("contentType").asString()).isEqualTo("application/protobuf");
            assertThat(actual.contentType()).isEqualTo("application/json");
            assertThat(actual.body()).as(actual.path()).isEqualTo(request.path("body"));
            assertThat(request.path("authorization").path("ttlSeconds").asLong()).isEqualTo(6 * 3600);
            assertSameToken(actual.authorization().substring("Bearer ".length()), request.path("authorization"));
        }
    }

    @Test
    void takesTheWebSocketAddressOfTheServer() {
        assertThat(LiveKitCallServer.httpUrl("wss://calls.example.org/")).isEqualTo("https://calls.example.org");
        assertThat(LiveKitCallServer.httpUrl("ws://livekit:7880")).isEqualTo("http://livekit:7880");
        assertThat(LiveKitCallServer.httpUrl("http://livekit:7880")).isEqualTo("http://livekit:7880");
    }

    @Test
    void isOffWithoutTheKeyAndTheSecret() {
        LiveKitCallServer off = new LiveKitCallServer(
                new MeetingsProperties(new MeetingsProperties.Livekit(url(), " ", null)), Clock.systemUTC());

        assertThat(off.enabled()).isFalse();
        assertThatThrownBy(() -> off.token(new Grant("tb-a", "u", "n", false)))
                .isInstanceOf(CallServerException.class);
        assertThatThrownBy(off::occupiedRooms).isInstanceOf(CallServerException.class);
        assertThatThrownBy(() -> off.removeParticipant("tb-a", "u")).isInstanceOf(CallServerException.class);
        assertThat(new LiveKitIntegrationCheck(off).check().getFirst().state()).isEqualTo(State.NOT_CONFIGURED);
    }

    @Test
    void refusesAShortSecret() {
        assertThatThrownBy(() -> new MeetingsProperties.Livekit(url(), "key", "short"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET");
        MeetingsProperties.Livekit settings = new MeetingsProperties.Livekit(url(), " key ", SECRET);
        assertThat(settings.apiKey()).isEqualTo("key");
        assertThat(settings.enabled()).isTrue();
    }

    /**
     * Header and claims equal the SDK's; {@code exp} is {@link LiveKitCallServer#TOKEN_TTL} from now.
     * The SDK also wrote an empty {@code sip} grant, which LiveKit reads as no SIP rights, as its absence.
     */
    private static void assertSameToken(String jwt, JsonNode sdk) {
        assertThat(sdk.path("claims").path("sip").isEmpty()).isTrue();
        ObjectNode expected = ((ObjectNode) sdk.path("claims")).deepCopy();
        expected.remove("sip");
        ObjectNode claims = claims(jwt);
        assertThat(claims.remove("exp").asLong()).isEqualTo(NOW.plus(LiveKitCallServer.TOKEN_TTL).getEpochSecond());
        assertThat(part(jwt, 0)).isEqualTo(sdk.path("header"));
        assertThat(claims).isEqualTo(expected);
    }

    private static JsonNode fixture() throws IOException {
        try (InputStream in = LiveKitCallServerTest.class.getResourceAsStream("sdk-fixtures.json")) {
            assertThat(in).as("sdk-fixtures.json").isNotNull();
            JsonNode fixture = JSON.readTree(in);
            assertThat(fixture.path("apiKey").asString()).isEqualTo("key");
            assertThat(fixture.path("apiSecret").asString()).isEqualTo(SECRET);
            return fixture;
        }
    }

    private LiveKitCallServer server(String apiUrl) {
        return new LiveKitCallServer(new MeetingsProperties(new MeetingsProperties.Livekit(apiUrl, "key", SECRET)),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private String url() {
        return "http://127.0.0.1:" + stub.getAddress().getPort();
    }

    private static ObjectNode claims(String jwt) {
        return (ObjectNode) part(jwt, 1);
    }

    private static JsonNode part(String jwt, int index) {
        return JSON.readTree(new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[index]),
                StandardCharsets.UTF_8));
    }

    private void answer(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = path.substring("/twirp/livekit.RoomService/".length());
        JsonNode request = JSON.readTree(exchange.getRequestBody().readAllBytes());
        requests.add(new Recorded(exchange.getRequestMethod(), path,
                exchange.getRequestHeaders().getFirst("Content-Type"),
                exchange.getRequestHeaders().getFirst("Authorization"), request));
        if (status != 200) {
            reply(exchange, status, error());
            return;
        }
        switch (method) {
            case "ListRooms" -> {
                calls.add(method);
                ObjectNode response = JSON.createObjectNode();
                if (!rooms.isEmpty()) {
                    rooms.forEach(room -> response.withArray("rooms").addObject().put("sid", "RM_" + room)
                            .put("name", room).put("num_participants", room.equals(ROOM_STALE) ? 0 : 1));
                }
                reply(exchange, 200, response);
            }
            case "ListParticipants" -> {
                String room = request.path("room").asString();
                calls.add(method + " " + room);
                ObjectNode response = JSON.createObjectNode();
                response.putArray("participants");
                if (room.equals(ROOM_STALE)) {
                    participant(response, "u-3", "Вера");
                }
                if (room.equals(ROOM_A)) {
                    participant(response, "u-1", "Анна");
                    participant(response, "u-2", "Борис");
                }
                reply(exchange, 200, response);
            }
            case "RemoveParticipant" -> {
                calls.add(method + " " + request.path("room").asString() + " " + request.path("identity").asString());
                reply(exchange, removeStatus, removeStatus == 200 ? JSON.createObjectNode() : error());
            }
            default -> reply(exchange, 404, error());
        }
    }

    private static void participant(ObjectNode response, String identity, String name) {
        response.withArray("participants").addObject().put("sid", "PA_" + identity).put("identity", identity)
                .put("name", name).put("state", "ACTIVE");
    }

    private static JsonNode error() {
        return JSON.createObjectNode().put("code", "error").put("msg", "x");
    }

    private static void reply(HttpExchange exchange, int code, JsonNode body) throws IOException {
        byte[] bytes = JSON.writeValueAsBytes(body);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(code, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
