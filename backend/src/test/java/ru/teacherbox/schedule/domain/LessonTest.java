package ru.teacherbox.schedule.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.shared.error.BusinessRuleException;

class LessonTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant START = Instant.parse("2026-10-02T15:00:00Z");
    private static final Supplier<UUID> IDS = UUID::randomUUID;
    private static final UUID ANNA = UUID.randomUUID();
    private static final UUID BORIS = UUID.randomUUID();
    private static final UUID VERA = UUID.randomUUID();

    private static Lesson planned() {
        return Lesson.plan(UUID.randomUUID(), ANNA, null, null, START, 60, "  Дроби ",
                " https://telemost.yandex.ru/j/1 ", NOW);
    }

    private static Lesson groupLesson() {
        return Lesson.planForGroup(UUID.randomUUID(), UUID.randomUUID(), List.of(ANNA, BORIS, ANNA), null, null,
                START, 90, null, null, NOW);
    }

    @Test
    void plansWithNormalizedTexts() {
        Lesson lesson = planned();

        assertThat(lesson.status()).isEqualTo(LessonStatus.SCHEDULED);
        assertThat(lesson.isGroup()).isFalse();
        assertThat(lesson.studentId()).isEqualTo(ANNA);
        assertThat(lesson.participants()).containsExactly(new Participant(ANNA, Attendance.EXPECTED, null));
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
        assertThatThrownBy(() -> Lesson.restore(UUID.randomUUID(), null, List.of(), null, null, START, 60, null, null,
                LessonStatus.SCHEDULED, null, null, null, NOW, NOW, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Participant(ANNA, Attendance.ATTENDED, null))
                .isInstanceOf(IllegalArgumentException.class);
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
        assertThat(lesson.cancel(CancelledBy.TEACHER, " Болезнь ", NOW)).isEmpty();

        assertThat(lesson.status()).isEqualTo(LessonStatus.CANCELLED);
        assertThat(lesson.cancelledBy()).isEqualTo(CancelledBy.TEACHER);
        assertThat(lesson.cancelReason()).isEqualTo("Болезнь");
        assertRule(() -> lesson.cancel(CancelledBy.TEACHER, null, NOW), "schedule.lesson-not-scheduled");
        assertRule(() -> lesson.edit(START, 60, null, null, NOW), "schedule.lesson-not-scheduled");
        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, IDS, START), "schedule.lesson-cancelled");
    }

    @Test
    void chargedCancellationCountsAsMissed() {
        Lesson lesson = planned();
        UUID completion = UUID.randomUUID();

        lesson.chargeCancellation(CancelledBy.STUDENT, "Заболел", completion, NOW);

        assertThat(lesson.status()).isEqualTo(LessonStatus.MISSED);
        assertThat(lesson.participants()).containsExactly(new Participant(ANNA, Attendance.MISSED, completion));
        assertThat(lesson.cancelledBy()).isEqualTo(CancelledBy.STUDENT);
        assertRule(() -> groupLesson().chargeCancellation(CancelledBy.STUDENT, null, completion, NOW),
                "schedule.lesson-group");
    }

    @Test
    void outcomesAreMarkedAfterTheStartAndCanBeCorrected() {
        Lesson lesson = planned();

        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, IDS, NOW), "schedule.lesson-not-started");
        assertRule(() -> lesson.complete(LessonStatus.SCHEDULED, IDS, START), "schedule.outcome-invalid");
        List<Participant.Change> first = lesson.complete(LessonStatus.CONDUCTED, IDS, START);
        assertThat(first).singleElement().satisfies(change -> {
            assertThat(change.studentId()).isEqualTo(ANNA);
            assertThat(change.revokedCompletionId()).isNull();
            assertThat(change.newCompletionId()).isNotNull();
            assertThat(change.missed()).isFalse();
        });
        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, IDS, START), "schedule.outcome-unchanged");
        List<Participant.Change> second = lesson.complete(LessonStatus.MISSED, IDS, START);
        assertThat(second.getFirst().revokedCompletionId()).isEqualTo(first.getFirst().newCompletionId());
        assertThat(second.getFirst().missed()).isTrue();
        assertThat(lesson.status()).isEqualTo(LessonStatus.MISSED);

        assertThat(lesson.reopen(START)).extracting(Participant::completionId)
                .containsExactly(second.getFirst().newCompletionId());
        assertThat(lesson.status()).isEqualTo(LessonStatus.SCHEDULED);
        assertThat(lesson.participants()).containsExactly(new Participant(ANNA, Attendance.EXPECTED, null));
        assertRule(() -> lesson.reopen(START), "schedule.lesson-not-completed");
    }

    @Test
    void conductedOutcomeClearsALateCancellation() {
        Lesson lesson = planned();
        lesson.chargeCancellation(CancelledBy.STUDENT, "Поздно", UUID.randomUUID(), NOW);

        lesson.complete(LessonStatus.CONDUCTED, IDS, START);

        assertThat(lesson.cancelledBy()).isNull();
        assertThat(lesson.cancelReason()).isNull();
    }

    @Test
    void aGroupLessonHasEveryMemberOnce() {
        Lesson lesson = groupLesson();

        assertThat(lesson.isGroup()).isTrue();
        assertThat(lesson.studentIds()).containsExactly(ANNA, BORIS);
        assertThat(lesson.expectedIds()).containsExactly(ANNA, BORIS);
        assertThat(lesson.attendance()).containsEntry(ANNA, Attendance.EXPECTED);
        assertThatThrownBy(lesson::studentId).isInstanceOf(IllegalStateException.class);
        assertRule(() -> lesson.complete(LessonStatus.CONDUCTED, IDS, START), "schedule.attendance-required");
    }

    @Test
    void attendanceChargesThoseWhoCameOrMissed() {
        Lesson lesson = groupLesson();

        assertRule(() -> lesson.markAttendance(Map.of(ANNA, Attendance.ATTENDED), IDS, START),
                "schedule.attendance-invalid");
        assertRule(() -> lesson.markAttendance(Map.of(ANNA, Attendance.ATTENDED, BORIS, Attendance.EXPECTED), IDS,
                START), "schedule.attendance-invalid");
        assertRule(() -> lesson.markAttendance(Map.of(ANNA, Attendance.EXCUSED, BORIS, Attendance.EXCUSED), IDS,
                START), "schedule.attendance-empty");

        List<Participant.Change> changes = lesson.markAttendance(
                Map.of(ANNA, Attendance.ATTENDED, BORIS, Attendance.EXCUSED), IDS, START);

        assertThat(lesson.status()).isEqualTo(LessonStatus.CONDUCTED);
        assertThat(changes).extracting(Participant.Change::studentId).containsExactly(ANNA, BORIS);
        assertThat(changes.get(1).newCompletionId()).as("an excused student is not charged").isNull();

        List<Participant.Change> corrected = lesson.markAttendance(
                Map.of(ANNA, Attendance.MISSED, BORIS, Attendance.EXCUSED), IDS, START);
        assertThat(corrected).singleElement().satisfies(change -> {
            assertThat(change.revokedCompletionId()).isEqualTo(changes.getFirst().newCompletionId());
            assertThat(change.missed()).isTrue();
        });
        assertThat(lesson.status()).as("nobody came").isEqualTo(LessonStatus.MISSED);

        assertThat(lesson.reopen(START)).extracting(Participant::studentId).containsExactly(ANNA);
        assertThat(lesson.attendance()).containsEntry(ANNA, Attendance.EXPECTED).containsEntry(BORIS,
                Attendance.EXCUSED);
    }

    @Test
    void aParticipantExcusesThemselves() {
        Lesson lesson = groupLesson();
        UUID late = UUID.randomUUID();

        lesson.excuse(ANNA, null, NOW);
        lesson.excuse(BORIS, late, NOW);

        assertThat(lesson.participants()).containsExactly(new Participant(ANNA, Attendance.EXCUSED, null),
                new Participant(BORIS, Attendance.MISSED, late));
        assertThat(lesson.expectedIds()).isEmpty();
        assertRule(() -> lesson.excuse(ANNA, null, NOW), "schedule.participant-not-expected");
        assertRule(() -> lesson.excuse(VERA, null, NOW), "schedule.participant-not-found");
        assertRule(() -> planned().excuse(ANNA, null, NOW), "schedule.lesson-not-group");

        assertThat(lesson.cancel(CancelledBy.TEACHER, null, NOW)).as("the charge in advance is revoked")
                .extracting(Participant::completionId).containsExactly(late);
        assertThat(lesson.attendance()).containsEntry(BORIS, Attendance.EXPECTED);
        assertRule(() -> lesson.excuse(ANNA, null, NOW), "schedule.lesson-not-scheduled");
    }

    @Test
    void membersJoinAndLeavePlannedLessons() {
        Lesson lesson = groupLesson();
        lesson.excuse(BORIS, UUID.randomUUID(), NOW);

        assertThat(lesson.addParticipant(VERA, NOW)).isTrue();
        assertThat(lesson.addParticipant(VERA, NOW)).isFalse();
        assertThat(lesson.removeParticipant(ANNA, NOW)).isTrue();
        assertThat(lesson.removeParticipant(BORIS, NOW)).as("a charged student stays").isFalse();
        assertThat(lesson.studentIds()).containsExactly(BORIS, VERA);
        assertThat(lesson.hasParticipant(ANNA)).isFalse();

        assertThat(planned().addParticipant(VERA, NOW)).isFalse();
        assertThat(planned().removeParticipant(ANNA, NOW)).isFalse();
        lesson.cancel(CancelledBy.TEACHER, null, NOW);
        assertThat(lesson.addParticipant(ANNA, NOW)).isFalse();
        assertThat(lesson.removeParticipant(VERA, NOW)).isFalse();
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
        Lesson lesson = Lesson.restore(UUID.randomUUID(), null, List.of(new Participant(ANNA, Attendance.EXPECTED,
                null)), series, LocalDate.of(2026, 10, 2), START, 45, null, null, LessonStatus.SCHEDULED, null, null,
                null, NOW, NOW, 3);

        lesson.markSaved(4);

        assertThat(lesson.seriesId()).isEqualTo(series);
        assertThat(lesson.seriesDate()).isEqualTo(LocalDate.of(2026, 10, 2));
        assertThat(lesson.groupId()).isNull();
        assertThat(lesson.participant(ANNA)).isPresent();
        assertThat(lesson.version()).isEqualTo(4);
        assertThat(lesson.createdAt()).isEqualTo(NOW);
        assertThat(lesson.updatedAt()).isEqualTo(NOW);
    }

    private static void assertRule(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}
