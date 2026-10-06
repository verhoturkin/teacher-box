package ru.teacherbox.meetings.livekit;

import io.livekit.server.AccessToken;
import io.livekit.server.CanPublish;
import io.livekit.server.CanPublishData;
import io.livekit.server.CanPublishSources;
import io.livekit.server.CanSubscribe;
import io.livekit.server.RoomAdmin;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import io.livekit.server.RoomServiceClient;
import java.io.IOException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import livekit.LivekitModels;
import okhttp3.OkHttpClient;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import retrofit2.Call;
import retrofit2.Response;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.meetings.application.MeetingsProperties;

/**
 * {@link CallServer} over the official LiveKit server SDK: tokens are signed locally, rooms are read
 * through the Twirp API. Only rooms of the portal ({@value #ROOM_PREFIX}…) are looked at.
 */
@Component
class LiveKitCallServer implements CallServer {

    static final String ROOM_PREFIX = "tb-";
    /** The token only opens the connection; LiveKit refreshes it while the user stays. */
    static final Duration TOKEN_TTL = Duration.ofMinutes(10);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);
    private static final List<String> SOURCES = List.of("camera", "microphone", "screen_share",
            "screen_share_audio");

    private final MeetingsProperties.Livekit settings;
    private final @Nullable RoomServiceClient rooms;

    LiveKitCallServer(MeetingsProperties properties) {
        this.settings = properties.livekit();
        this.rooms = settings.enabled()
                ? RoomServiceClient.createClient(settings.apiUrl(), key(), secret(), LiveKitCallServer::http, false)
                : null;
    }

    @Override
    public boolean enabled() {
        return rooms != null;
    }

    @Override
    public String token(Grant grant) {
        requireEnabled();
        AccessToken token = new AccessToken(key(), secret());
        token.setIdentity(grant.identity());
        token.setName(grant.name());
        token.setTtl(TOKEN_TTL.toMillis());
        token.addGrants(new RoomJoin(true), new RoomName(grant.room()), new CanSubscribe(true),
                new CanPublish(true), new CanPublishData(true), new CanPublishSources(SOURCES),
                new RoomAdmin(grant.admin()));
        return token.toJwt();
    }

    @Override
    public Map<String, List<Participant>> occupiedRooms() {
        RoomServiceClient client = requireEnabled();
        Map<String, List<Participant>> result = new LinkedHashMap<>();
        for (LivekitModels.Room room : body(client.listRooms(), "ListRooms")) {
            if (room.getName().startsWith(ROOM_PREFIX) && room.getNumParticipants() > 0) {
                List<Participant> participants = body(client.listParticipants(room.getName()), "ListParticipants")
                        .stream()
                        .map(info -> new Participant(info.getIdentity(), info.getName()))
                        .toList();
                if (!participants.isEmpty()) {
                    result.put(room.getName(), participants);
                }
            }
        }
        return result;
    }

    @Override
    public void removeParticipant(String room, String identity) {
        RoomServiceClient client = requireEnabled();
        Response<Void> response = execute(client.removeParticipant(room, identity), "RemoveParticipant");
        if (!response.isSuccessful() && response.code() != 404) {
            throw failed("RemoveParticipant", response);
        }
    }

    private RoomServiceClient requireEnabled() {
        if (rooms == null) {
            throw new CallServerException("Calls are off: TEACHERBOX_MEETINGS_LIVEKIT_API_KEY/SECRET are not set");
        }
        return rooms;
    }

    private static <T> T body(Call<T> call, String method) {
        Response<T> response = execute(call, method);
        T body = response.body();
        if (!response.isSuccessful() || body == null) {
            throw failed(method, response);
        }
        return body;
    }

    private static <T> Response<T> execute(Call<T> call, String method) {
        try {
            return call.execute();
        } catch (IOException e) {
            throw new CallServerException("LiveKit " + method + ": " + e.getMessage(), e);
        }
    }

    private static CallServerException failed(String method, Response<?> response) {
        return new CallServerException("LiveKit " + method + " answered " + response.code()
                + (response.code() == 401 ? " (wrong API key or secret)" : ""));
    }

    private String key() {
        return String.valueOf(settings.apiKey());
    }

    private String secret() {
        return String.valueOf(settings.apiSecret());
    }

    private static OkHttpClient http() {
        return new OkHttpClient.Builder()
                .connectTimeout(CONNECT_TIMEOUT)
                .readTimeout(READ_TIMEOUT)
                .callTimeout(READ_TIMEOUT.multipliedBy(2))
                .build();
    }
}
