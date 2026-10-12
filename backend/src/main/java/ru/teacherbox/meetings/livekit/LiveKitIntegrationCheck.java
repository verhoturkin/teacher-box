package ru.teacherbox.meetings.livekit;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.i18n.Language;

/** Lists the rooms of the media server: proves its address, key and secret. */
@Component
class LiveKitIntegrationCheck implements IntegrationCheck {


    private final CallServer server;

    LiveKitIntegrationCheck(CallServer server) {
        this.server = server;
    }

    @Override
    public List<IntegrationStatus> check() {
        // in the language of the administrator's page (ADR-0036)
        boolean russian = Language.current() == Language.RU;
        String name = russian ? "Видеозвонки (LiveKit)" : "Video calls (LiveKit)";
        if (!server.enabled()) {
            return List.of(IntegrationStatus.notConfigured(name, russian
                    ? "Не заданы TEACHERBOX_MEETINGS_LIVEKIT_API_KEY и _API_SECRET"
                    : "TEACHERBOX_MEETINGS_LIVEKIT_API_KEY and _API_SECRET are not set"));
        }
        long started = System.nanoTime();
        try {
            int rooms = server.occupiedRooms().size();
            return List.of(new IntegrationStatus(name, State.OK,
                    (russian ? "Идёт звонков: " : "Calls in progress: ") + rooms, elapsed(started)));
        } catch (CallServerException e) {
            return List.of(new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()),
                    elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
