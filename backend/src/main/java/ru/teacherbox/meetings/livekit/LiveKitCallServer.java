package ru.teacherbox.meetings.livekit;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.meetings.application.MeetingsProperties;
import ru.teacherbox.meetings.domain.CallRooms;
import ru.teacherbox.shared.http.OutboundHttp;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;

/**
 * {@link CallServer} over the LiveKit server API without its SDK (ADR-0060): access tokens are JWTs
 * signed locally with HS256 (Nimbus), rooms are read through the Twirp room service with JSON
 * bodies. Only rooms of the portal ({@link CallRooms}) are looked at.
 */
@Component
class LiveKitCallServer implements CallServer {

    /** The token only opens the connection; LiveKit refreshes it while the user stays. */
    static final Duration TOKEN_TTL = Duration.ofMinutes(10);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);
    private static final String ROOM_SERVICE = "/twirp/livekit.RoomService/";
    private static final List<String> SOURCES = List.of("camera", "microphone", "screen_share",
            "screen_share_audio");

    private final MeetingsProperties.Livekit settings;
    private final Clock clock;
    private final @Nullable RestClient rooms;

    LiveKitCallServer(MeetingsProperties properties, Clock clock) {
        this.settings = properties.livekit();
        this.clock = clock;
        this.rooms = settings.enabled()
                ? RestClient.builder()
                        .baseUrl(httpUrl(settings.apiUrl()))
                        .requestFactory(OutboundHttp.requestFactory(CONNECT_TIMEOUT, READ_TIMEOUT, null))
                        .build()
                : null;
    }

    @Override
    public boolean enabled() {
        return rooms != null;
    }

    @Override
    public String token(Grant grant) {
        requireEnabled();
        Map<String, Object> video = new LinkedHashMap<>();
        video.put("roomJoin", true);
        video.put("room", grant.room());
        video.put("canSubscribe", true);
        video.put("canPublish", true);
        video.put("canPublishData", true);
        video.put("canPublishSources", SOURCES);
        video.put("roomAdmin", grant.admin());
        return sign(new JWTClaimsSet.Builder().subject(grant.identity()).claim("name", grant.name()), video);
    }

    @Override
    public Map<String, List<Participant>> occupiedRooms() {
        Map<String, List<Participant>> result = new LinkedHashMap<>();
        for (JsonNode room : call("ListRooms", Map.of(), Map.of("roomList", true), false).path("rooms")) {
            String name = room.path("name").asString();
            // not num_participants: LiveKit updates it seconds after a join, the participants are exact
            if (CallRooms.owner(name).isPresent()) {
                List<Participant> participants = new ArrayList<>();
                JsonNode answer = call("ListParticipants", Map.of("room", name), admin(name), false);
                for (JsonNode info : answer.path("participants")) {
                    participants.add(new Participant(info.path("identity").asString(), info.path("name").asString()));
                }
                if (!participants.isEmpty()) {
                    result.put(name, List.copyOf(participants));
                }
            }
        }
        return result;
    }

    @Override
    public void removeParticipant(String room, String identity) {
        // a participant who has already left is not an error
        call("RemoveParticipant", Map.of("room", room, "identity", identity), admin(room), true);
    }

    private static Map<String, Object> admin(String room) {
        Map<String, Object> video = new LinkedHashMap<>();
        video.put("roomAdmin", true);
        video.put("room", room);
        return video;
    }

    /**
     * A Twirp call: POST of a JSON body with a token of the given grant.
     *
     * @param goneIsFine Twirp {@code not_found} (404) answers an empty node instead of failing
     */
    private JsonNode call(String method, Map<String, Object> body, Map<String, Object> video, boolean goneIsFine) {
        RestClient client = requireEnabled();
        try {
            JsonNode answer = client.post()
                    .uri(ROOM_SERVICE + method)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + sign(new JWTClaimsSet.Builder(), video))
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            return answer == null ? MissingNode.getInstance() : answer;
        } catch (RestClientResponseException e) {
            int code = e.getStatusCode().value();
            if (code == 404 && goneIsFine) {
                return MissingNode.getInstance();
            }
            throw new CallServerException("LiveKit " + method + " answered " + code
                    + (code == 401 ? " (wrong API key or secret)" : ""));
        } catch (RestClientException e) {
            throw new CallServerException("LiveKit " + method + ": " + e.getMessage(), e);
        }
    }

    /** The claims of the LiveKit documentation: issuer = API key, expiry, the {@code video} grant. */
    private String sign(JWTClaimsSet.Builder claims, Map<String, Object> video) {
        JWTClaimsSet set = claims
                .issuer(key())
                .expirationTime(Date.from(clock.instant().plus(TOKEN_TTL)))
                .claim("video", video)
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.HS256).type(JOSEObjectType.JWT).build(), set);
        try {
            jwt.sign(new MACSigner(String.valueOf(settings.apiSecret())));
        } catch (JOSEException e) {
            // the secret is checked to be at least 256 bits long at startup
            throw new IllegalStateException("LiveKit token not signed", e);
        }
        return jwt.serialize();
    }

    private RestClient requireEnabled() {
        if (rooms == null) {
            throw new CallServerException("Calls are off: TEACHERBOX_MEETINGS_LIVEKIT_API_KEY/SECRET are not set");
        }
        return rooms;
    }

    private String key() {
        return String.valueOf(settings.apiKey());
    }

    /** The room service takes the WebSocket address too, as the SDK did. */
    static String httpUrl(String apiUrl) {
        String url = apiUrl.startsWith("wss://") ? "https://" + apiUrl.substring(6)
                : apiUrl.startsWith("ws://") ? "http://" + apiUrl.substring(5) : apiUrl;
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
