package ru.teacherbox.schedule.application;

import java.util.List;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.google.GoogleCalendarService;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): lessons, series, requests, calendar feeds and the Google Calendar
 * connection; the portal's calendar in Google is deleted.
 */
@Component
class ScheduleDataReset implements DataReset {

    private static final List<String> TABLES = List.of("schedule.lesson_participants", "schedule.reminders_sent",
            "schedule.change_requests", "schedule.google_events", "schedule.lessons", "schedule.series",
            "schedule.feeds", "schedule.google_connection", "schedule.google_oauth_states");

    private final JdbcClient jdbc;
    private final GoogleCalendarService google;
    private BooleanSupplier removal = () -> true;

    ScheduleDataReset(JdbcClient jdbc, GoogleCalendarService google) {
        this.jdbc = jdbc;
        this.google = google;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        removal = google.removalForReset();
        for (String table : TABLES) {
            jdbc.sql("delete from " + table).update();
        }
    }

    @Override
    public Optional<String> afterErase() {
        BooleanSupplier remove = removal;
        removal = () -> true;
        return remove.getAsBoolean() ? Optional.empty()
                : Optional.of("Календарь портала остался в Google Календаре — удалите его там вручную.");
    }
}
