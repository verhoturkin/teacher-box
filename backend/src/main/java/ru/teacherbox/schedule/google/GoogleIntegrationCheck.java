package ru.teacherbox.schedule.google;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;

/** Checks the teacher's Google Calendar connection (through the Google proxy if one is set). */
@Component
class GoogleIntegrationCheck implements IntegrationCheck {

    static final String NAME = "Google Календарь";

    private final GoogleCalendarService google;

    GoogleIntegrationCheck(GoogleCalendarService google) {
        this.google = google;
    }

    @Override
    public List<IntegrationStatus> check() {
        long started = System.nanoTime();
        try {
            String found = google.checkConnection();
            return List.of(found == null
                    ? IntegrationStatus.notConfigured(NAME, "Не подключён")
                    : new IntegrationStatus(NAME, State.OK, found, elapsed(started)));
        } catch (GoogleException e) {
            return List.of(new IntegrationStatus(NAME, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
