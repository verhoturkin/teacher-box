package ru.teacherbox.schedule.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;
import ru.teacherbox.schedule.application.TeacherAvailability.ExternalBusyTimes;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.shared.error.ConflictException;

class TeacherAvailabilityTest {

    private static final Instant NINE = Instant.parse("2026-10-01T09:00:00Z");

    private static Instant at(int hour) {
        return NINE.plusSeconds((hour - 9) * 3600L);
    }

    private static TeacherAvailability availability(@Nullable ExternalBusyTimes calendar) {
        return availability(calendar, List.of());
    }

    private static TeacherAvailability availability(@Nullable ExternalBusyTimes calendar, List<BusyTime> offTime) {
        LessonRepository lessons = mock(LessonRepository.class);
        when(lessons.findOverlapping(any(), any())).thenReturn(List.of());
        OffTimeService offTimes = mock(OffTimeService.class);
        when(offTimes.busy(any(), any())).thenReturn(offTime);
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        if (calendar != null) {
            beans.addBean("calendar", calendar);
        }
        ObjectProvider<ExternalBusyTimes> provider = beans.getBeanProvider(ExternalBusyTimes.class);
        return new TeacherAvailability(lessons, offTimes, provider);
    }

    @Test
    void mergesOverlappingAndAdjacentPeriods() {
        assertThat(TeacherAvailability.merge(List.of(
                new BusyTime(at(12), at(13)),
                new BusyTime(at(9), at(10)),
                new BusyTime(at(10), at(11)),
                new BusyTime(at(12), at(12)),
                new BusyTime(at(15), at(16)))))
                .containsExactly(new BusyTime(at(9), at(11)), new BusyTime(at(12), at(13)),
                        new BusyTime(at(15), at(16)));
    }

    @Test
    void countsTheTeachersCalendarWithinThePeriod() {
        TeacherAvailability availability = availability((from, to) -> List.of(
                new BusyTime(at(10), at(12)), new BusyTime(at(20), at(21))));

        assertThat(availability.forStudent(UUID.randomUUID(), at(9), at(18)))
                .containsExactly(new BusyTime(at(10), at(12)));
        assertThat(availability.isFree(at(12), at(13), null)).isTrue();
        assertThatThrownBy(() -> availability.requireFree(at(11), at(12), UUID.randomUUID()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("busy");
    }

    @Test
    void countsTheTimeTheTeacherDoesNotWork() {
        TeacherAvailability availability = availability(null, List.of(new BusyTime(at(13), at(14))));

        assertThat(availability.forStudent(UUID.randomUUID(), at(9), at(18)))
                .containsExactly(new BusyTime(at(13), at(14)));
        assertThat(availability.isFree(at(13), at(14), null)).isFalse();
    }

    @Test
    void worksWithoutTheCalendar() {
        assertThat(availability(null).isFree(at(9), at(10), null)).isTrue();
    }
}
