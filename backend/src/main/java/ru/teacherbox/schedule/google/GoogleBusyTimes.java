package ru.teacherbox.schedule.google;

import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;
import ru.teacherbox.schedule.application.TeacherAvailability.ExternalBusyTimes;

/**
 * The busy time of the teacher's Google Calendar for the free-time check. When Google does not answer,
 * the portal's own lessons still count and the check goes on without the calendar.
 */
@Component
class GoogleBusyTimes implements ExternalBusyTimes {

    private static final Logger log = LoggerFactory.getLogger(GoogleBusyTimes.class);

    private final GoogleCalendarService calendar;

    GoogleBusyTimes(GoogleCalendarService calendar) {
        this.calendar = calendar;
    }

    @Override
    public List<BusyTime> busy(Instant from, Instant to) {
        try {
            return calendar.busy(from, to).stream().map(time -> new BusyTime(time.start(), time.end())).toList();
        } catch (GoogleException e) {
            log.warn("Google Calendar busy times are unavailable: {}", e.getMessage());
            return List.of();
        }
    }
}
