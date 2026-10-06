package ru.teacherbox.meetings.livekit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.google.protobuf.MessageLite;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import livekit.LivekitModels;
import livekit.LivekitRoom;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.teacherbox.meetings.application.CallServer.Grant;
import ru.teacherbox.meetings.application.CallServer.Participant;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.meetings.application.MeetingsProperties;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.State;

/** The adapter against an imitation of the Twirp API of LiveKit (protobuf bodies). */
class LiveKitCallServerTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef";
    private static final String ROOM_A = "tb-00000000-0000-7000-8000-00000000000a";
    private static final String ROOM_GONE = "tb-00000000-0000-7000-8000-00000000000b";

    private HttpServer stub;
    private final List<String> calls = new ArrayList<>();
    private int status = 200;
    private int removeStatus = 200;

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
        Map<String, List<Participant>> rooms = server(url()).occupiedRooms();

        assertThat(rooms).containsOnlyKeys(ROOM_A);
        assertThat(rooms.get(ROOM_A)).containsExactly(new Participant("u-1", "Анна"), new Participant("u-2", "Борис"));
        assertThat(calls).containsExactly("ListRooms", "ListParticipants " + ROOM_A, "ListParticipants " + ROOM_GONE);
        assertThat(new LiveKitIntegrationCheck(server(url())).check().getFirst()).satisfies(result -> {
            assertThat(result.state()).isEqualTo(State.OK);
            assertThat(result.detail()).isEqualTo("Идёт звонков: 1");
        });
    }

    @Test
    void reportsAWrongKeyAndAnUnreachableServer() {
        status = 401;
        assertThatThrownBy(() -> server(url()).occupiedRooms()).isInstanceOf(CallServerException.class)
                .hasMessage("LiveKit ListRooms answered 401 (wrong API key or secret)");
        assertThat(new LiveKitIntegrationCheck(server(url())).check().getFirst().state()).isEqualTo(State.FAILED);

        status = 500;
        assertThatThrownBy(() -> server(url()).occupiedRooms()).hasMessage("LiveKit ListRooms answered 500");

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

        assertThat(claims(student)).contains("\"sub\":\"u-1\"", "\"name\":\"Анна\"", "\"room\":\"tb-a\"",
                "\"roomJoin\":true", "\"iss\":\"key\"", "screen_share").doesNotContain("\"roomAdmin\":true");
        assertThat(claims(teacher)).contains("\"roomAdmin\":true");
        assertThat(calls).as("signed locally").isEmpty();
    }

    @Test
    void isOffWithoutTheKeyAndTheSecret() {
        LiveKitCallServer off = new LiveKitCallServer(
                new MeetingsProperties(new MeetingsProperties.Livekit(url(), " ", null)));

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

    private LiveKitCallServer server(String apiUrl) {
        return new LiveKitCallServer(
                new MeetingsProperties(new MeetingsProperties.Livekit(apiUrl, "key", SECRET)));
    }

    private String url() {
        return "http://127.0.0.1:" + stub.getAddress().getPort();
    }

    private static String claims(String jwt) {
        return new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]), StandardCharsets.UTF_8);
    }

    private void answer(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestURI().getPath().substring("/twirp/livekit.RoomService/".length());
        byte[] request = exchange.getRequestBody().readAllBytes();
        if (status != 200) {
            reply(exchange, status, null);
            return;
        }
        switch (method) {
            case "ListRooms" -> {
                calls.add(method);
                reply(exchange, 200, LivekitRoom.ListRoomsResponse.newBuilder()
                        .addRooms(room(ROOM_A, 2)).addRooms(room("tb-x", 1)).addRooms(room("other", 1))
                        .addRooms(room(ROOM_GONE, 1)).addRooms(room("tb-00000000-0000-7000-8000-00000000000c", 0))
                        .build());
            }
            case "ListParticipants" -> {
                String room = LivekitRoom.ListParticipantsRequest.parseFrom(request).getRoom();
                calls.add(method + " " + room);
                LivekitRoom.ListParticipantsResponse.Builder response =
                        LivekitRoom.ListParticipantsResponse.newBuilder();
                if (room.equals(ROOM_A)) {
                    response.addParticipants(participant("u-1", "Анна")).addParticipants(participant("u-2", "Борис"));
                }
                reply(exchange, 200, response.build());
            }
            case "RemoveParticipant" -> {
                LivekitRoom.RoomParticipantIdentity target = LivekitRoom.RoomParticipantIdentity.parseFrom(request);
                calls.add(method + " " + target.getRoom() + " " + target.getIdentity());
                reply(exchange, removeStatus,
                        removeStatus == 200 ? LivekitRoom.RemoveParticipantResponse.getDefaultInstance() : null);
            }
            default -> reply(exchange, 404, null);
        }
    }

    private static LivekitModels.Room room(String name, int participants) {
        return LivekitModels.Room.newBuilder().setName(name).setNumParticipants(participants).build();
    }

    private static LivekitModels.ParticipantInfo participant(String identity, String name) {
        return LivekitModels.ParticipantInfo.newBuilder().setIdentity(identity).setName(name).build();
    }

    private static void reply(HttpExchange exchange, int code, @Nullable MessageLite body) throws IOException {
        byte[] bytes = body == null
                ? "{\"code\":\"error\",\"msg\":\"x\"}".getBytes(StandardCharsets.UTF_8)
                : body.toByteArray();
        exchange.getResponseHeaders().set("Content-Type", body == null ? "application/json" : "application/protobuf");
        exchange.sendResponseHeaders(code, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) {
            exchange.getResponseBody().write(bytes);
        }
        exchange.close();
    }
}
