package ru.teacherbox.meetings.livekit;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;

/** Lists the rooms of the media server: proves its address, key and secret. */
@Component
class LiveKitIntegrationCheck implements IntegrationCheck {

    static final String NAME = "Видеозвонки (LiveKit)";

    private final CallServer server;

    LiveKitIntegrationCheck(CallServer server) {
        this.server = server;
    }

    @Override
    public List<IntegrationStatus> check() {
        if (!server.enabled()) {
            return List.of(IntegrationStatus.notConfigured(NAME,
                    "Не заданы TEACHERBOX_MEETINGS_LIVEKIT_API_KEY и _API_SECRET"));
        }
        long started = System.nanoTime();
        try {
            int rooms = server.occupiedRooms().size();
            return List.of(new IntegrationStatus(NAME, State.OK, "Идёт звонков: " + rooms, elapsed(started)));
        } catch (CallServerException e) {
            return List.of(new IntegrationStatus(NAME, State.FAILED, String.valueOf(e.getMessage()),
                    elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
