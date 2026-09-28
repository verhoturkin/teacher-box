package ru.teacherbox.schedule.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;

class GoogleBusyTimesTest {

    private static final Instant FROM = Instant.parse("2026-10-01T09:00:00Z");
    private static final Instant TO = Instant.parse("2026-10-01T18:00:00Z");

    @Test
    void givesTheBusyTimeOfTheCalendarOrNothingWhenGoogleFails() {
        GoogleCalendarService calendar = mock(GoogleCalendarService.class);
        Instant noon = Instant.parse("2026-10-01T12:00:00Z");
        when(calendar.busy(FROM, TO)).thenReturn(List.of(new GoogleApi.Busy(noon, noon.plusSeconds(3600))));
        GoogleBusyTimes busy = new GoogleBusyTimes(calendar);

        assertThat(busy.busy(FROM, TO)).containsExactly(new BusyTime(noon, noon.plusSeconds(3600)));

        when(calendar.busy(FROM, TO)).thenThrow(new GoogleException("Google free/busy: 503"));
        assertThat(busy.busy(FROM, TO)).isEmpty();
    }
}
