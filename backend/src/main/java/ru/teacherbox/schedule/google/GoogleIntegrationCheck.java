package ru.teacherbox.schedule.google;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.i18n.Language;

/** Checks the teacher's Google Calendar connection (through the Google proxy if one is set). */
@Component
class GoogleIntegrationCheck implements IntegrationCheck {


    private final GoogleCalendarService google;

    GoogleIntegrationCheck(GoogleCalendarService google) {
        this.google = google;
    }

    @Override
    public List<IntegrationStatus> check() {
        // in the language of the administrator's page (ADR-0036)
        Language language = Language.current();
        String name = language == Language.RU ? "Google Календарь" : "Google Calendar";
        long started = System.nanoTime();
        try {
            String found = google.checkConnection(language);
            return List.of(found == null
                    ? IntegrationStatus.notConfigured(name, language == Language.RU ? "Не подключён" : "Not connected")
                    : new IntegrationStatus(name, State.OK, found, elapsed(started)));
        } catch (GoogleException e) {
            return List.of(new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
