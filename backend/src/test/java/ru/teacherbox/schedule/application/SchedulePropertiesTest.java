package ru.teacherbox.schedule.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.api.ChangeKind;

class SchedulePropertiesTest {

    @Test
    void lessonRulesSortRemindersWithoutRepeats() {
        LessonRules rules = new LessonRules(60, Duration.ofHours(24),
                List.of(Duration.ofHours(24), Duration.ofHours(1), Duration.ofHours(24)), Duration.ofDays(84));

        assertThat(rules.reminders()).containsExactly(Duration.ofHours(1), Duration.ofHours(24));
        assertThat(rules.horizonDays()).isEqualTo(84);
    }

    @Test
    void lateCancellationIsCountedFromTheRequest() {
        Instant lesson = Instant.parse("2026-10-02T15:00:00Z");
        Duration policy = Duration.ofHours(24);

        assertThat(ScheduleViews.isLate(ChangeKind.CANCEL, lesson, lesson.minus(Duration.ofHours(23)), policy)).isTrue();
        assertThat(ScheduleViews.isLate(ChangeKind.CANCEL, lesson, lesson.minus(Duration.ofHours(24)), policy)).isFalse();
        assertThat(ScheduleViews.isLate(ChangeKind.RESCHEDULE, lesson, lesson.minusSeconds(60), policy)).isFalse();
    }

    @Test
    void googleClientComesFromTheEnvironmentOnlyWhenComplete() {
        assertThat(google().clientFromEnvironment()).isFalse();
        assertThat(new ScheduleProperties.Google("id", " ", null, "a", "o", "c").clientFromEnvironment()).isFalse();
        assertThat(new ScheduleProperties.Google("id", "secret", null, "a", "o", "c").clientFromEnvironment()).isTrue();
    }

    private static ScheduleProperties.Google google() {
        return new ScheduleProperties.Google(null, null, null, "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com", "https://www.googleapis.com/calendar/v3");
    }
}
