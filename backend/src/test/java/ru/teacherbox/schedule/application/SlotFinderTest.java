package ru.teacherbox.schedule.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;

class SlotFinderTest {

    private static final Instant NINE = Instant.parse("2026-10-01T09:00:00Z");
    private static final Duration HALF_HOUR = Duration.ofMinutes(30);

    private static Instant at(int hour, int minute) {
        return NINE.plus(Duration.ofHours(hour - 9L)).plusSeconds(minute * 60L);
    }

    @Test
    void startsEveryStepWhereTheWholeLessonIsFree() {
        List<BusyTime> busy = List.of(new BusyTime(at(10, 0), at(11, 0)));

        assertThat(SlotFinder.freeStarts(at(9, 0), at(12, 0), at(9, 0), busy, Duration.ofHours(1), HALF_HOUR))
                .containsExactly(at(9, 0), at(11, 0), at(11, 30));
    }

    @Test
    void skipsStartsBeforeNow() {
        assertThat(SlotFinder.freeStarts(at(9, 0), at(11, 0), at(9, 40), List.of(), HALF_HOUR, HALF_HOUR))
                .containsExactly(at(10, 0), at(10, 30));
    }

    @Test
    void refusesAnEmptyStep() {
        assertThatThrownBy(() -> SlotFinder.freeStarts(at(9, 0), at(10, 0), at(9, 0), List.of(), HALF_HOUR,
                Duration.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SlotFinder.freeStarts(at(9, 0), at(10, 0), at(9, 0), List.of(), Duration.ZERO,
                HALF_HOUR)).isInstanceOf(IllegalArgumentException.class);
    }
}
