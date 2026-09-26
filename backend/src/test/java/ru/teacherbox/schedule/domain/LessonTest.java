package ru.teacherbox.schedule.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.shared.error.BusinessRuleException;

class LessonTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant START = Instant.parse("2026-10-02T15:00:00Z");

    private static Lesson planned() {
        return Lesson.plan(UUID.randomUUID(), UUID.randomUUID(), null, null, START, 60, "  Дроби ",
                " https://telemost.yandex.ru/j/1 ", NOW);
    }

    @Test
    void plansWithNormalizedTexts() {
        Lesson lesson = planned();

        assertThat(lesson.status()).isEqualTo(LessonStatus.SCHEDULED);
        assertThat(lesson.topic()).isEqualTo("Дроби");
        assertThat(lesson.meetingUrl()).isEqualTo("https://telemost.yandex.ru/j/1");
        assertThat(lesson.endsAt()).isEqualTo(START.plus(Duration.ofHours(1)));
        assertThat(lesson.version()).isZero();
    }

    @Test
    void validatesDurationTextsAndLinks() {
        UUID student = UUID.randomUUID();
        assertRule(() -> Lesson.plan(UUID.randomUUID(), student, null, null, START, 0, null, null, NOW),
                "schedule.duration-invalid");
        assertRule(() -> Lesson.plan(UUID.randomUUID(), student, null, null, START, 601, null, null, NOW),
                "schedule.duration-invalid");
        assertRule(() -> Lesson.plan(UUID.randomUUID(), student, null, null, START, 60, "т".repeat(501), null, NOW),
                "schedule.text-too-long");
        assertRule(() -> Lesson.plan(UUID.randomUUID(), student, null, null, START, 60, null, "ftp://x", NOW),
                "schedule.meeting-url-invalid");
        assertRule(() -> Lesson.plan(UUID.randomUUID(), student, null, null, START, 60, null, "not a link", NOW),
                "schedule.meeting-url-invalid");
        assertRule(() -> Lesson.plan(UUID.randomUUID(), student, null, null, START, 60, null,
                "https://x/" + "a".repeat(1000), NOW), "schedule.meeting-url-invalid");
        assertThat(Lesson.plan(UUID.randomUUID(), student, null, null, START, 60, " ", " ", NOW).topic()).isNull();
        assertThatThrownBy(() -> Lesson.plan(UUID.randomUUID(), student, UUID.randomUUID(), null, START, 60, null,
                null, NOW)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void remembersTheOriginalTimeWhenMoved() {
        Lesson lesson = planned();

        assertThat(lesson.edit(START, 60, "Дроби", null, NOW)).as("only the link changed").isFalse();
        assertThat(lesson.originalStartsAt()).isNull();
        assertThat(lesson.edit(START.plusSeconds(3600), 90, null, null, NOW)).isTrue();
        assertThat(lesson.edit(START.plusSeconds(7200), 90, null, null, NOW)).isTrue();

        assertThat(lesson.originalStartsAt()).isEqualTo(START);
        assertThat(lesson.durationMinutes()).isEqualTo(90);
        assertThat(lesson.edit(START.plusSeconds(7200), 60, null, null, NOW)).as("duration changed").isTrue();
    }

    @Test
    void cancelsOnlyPlannedLessons() {
        Lesson lesson = planned();
        lesson.cancel(CancelledBy.TEACHER, " Болезнь ", NOW);

        assertThat(lesson.status()).isEqualTo(LessonStatus.CANCELLED);
        assertThat(lesson.cancelledBy()).isEqualTo(CancelledBy.TEACHER);
        assertThat(lesson.cancelReason()).isEqualTo("Болезнь");
        assertRule(() -> lesson.cancel(CancelledBy.TEACHER, null, NOW), "schedule.lesson-not-scheduled");
        assertRule(() -> lesson.edit(START, 60, null, null, NOW), "schedule.lesson-not-scheduled");
        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, UUID.randomUUID(), START), "schedule.lesson-cancelled");
    }

    @Test
    void chargedCancellationCountsAsMissed() {
        Lesson lesson = planned();
        UUID completion = UUID.randomUUID();

        lesson.chargeCancellation(CancelledBy.STUDENT, "Заболел", completion, NOW);

        assertThat(lesson.status()).isEqualTo(LessonStatus.MISSED);
        assertThat(lesson.completionId()).isEqualTo(completion);
        assertThat(lesson.cancelledBy()).isEqualTo(CancelledBy.STUDENT);
    }

    @Test
    void outcomesAreMarkedAfterTheStartAndCanBeCorrected() {
        Lesson lesson = planned();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();

        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, first, NOW), "schedule.lesson-not-started");
        assertRule(() -> lesson.complete(LessonStatus.SCHEDULED, first, START), "schedule.outcome-invalid");
        assertThat(lesson.complete(LessonStatus.CONDUCTED, first, START)).isNull();
        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, second, START), "schedule.outcome-unchanged");
        assertThat(lesson.complete(LessonStatus.MISSED, second, START)).isEqualTo(first);
        assertThat(lesson.completionId()).isEqualTo(second);

        assertThat(lesson.reopen(START)).isEqualTo(second);
        assertThat(lesson.status()).isEqualTo(LessonStatus.SCHEDULED);
        assertThat(lesson.completionId()).isNull();
        assertRule(() -> lesson.reopen(START), "schedule.lesson-not-completed");
    }

    @Test
    void conductedOutcomeClearsALateCancellation() {
        Lesson lesson = planned();
        lesson.chargeCancellation(CancelledBy.STUDENT, "Поздно", UUID.randomUUID(), NOW);

        lesson.complete(LessonStatus.CONDUCTED, UUID.randomUUID(), START);

        assertThat(lesson.cancelledBy()).isNull();
        assertThat(lesson.cancelReason()).isNull();
    }

    @Test
    void overlapsHalfOpenIntervals() {
        Lesson lesson = planned();

        assertThat(lesson.overlaps(START.minusSeconds(3600), START)).isFalse();
        assertThat(lesson.overlaps(START.plusSeconds(3600), START.plusSeconds(7200))).isFalse();
        assertThat(lesson.overlaps(START.plusSeconds(1800), START.plusSeconds(5400))).isTrue();
    }

    @Test
    void restoresAndTracksVersions() {
        UUID series = UUID.randomUUID();
        Lesson lesson = Lesson.restore(UUID.randomUUID(), UUID.randomUUID(), series, LocalDate.of(2026, 10, 2), START,
                45, null, null, LessonStatus.SCHEDULED, null, null, null, null, NOW, NOW, 3);

        lesson.markSaved(4);

        assertThat(lesson.seriesId()).isEqualTo(series);
        assertThat(lesson.seriesDate()).isEqualTo(LocalDate.of(2026, 10, 2));
        assertThat(lesson.version()).isEqualTo(4);
        assertThat(lesson.createdAt()).isEqualTo(NOW);
        assertThat(lesson.updatedAt()).isEqualTo(NOW);
    }

    private static void assertRule(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}
