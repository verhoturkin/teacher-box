package ru.teacherbox.schedule.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.shared.error.BusinessRuleException;

class ChangeRequestTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant START = Instant.parse("2026-10-02T15:00:00Z");

    private static Lesson lesson() {
        return Lesson.plan(UUID.randomUUID(), UUID.randomUUID(), null, null, START, 60, null, null, NOW);
    }

    @Test
    void opensARescheduleWithATimeInTheFuture() {
        Lesson lesson = lesson();

        ChangeRequest request = ChangeRequest.open(UUID.randomUUID(), lesson, ChangeKind.RESCHEDULE,
                START.plusSeconds(86_400), " Можно в пятницу? ", NOW);

        assertThat(request.status()).isEqualTo(RequestStatus.PENDING);
        assertThat(request.lessonId()).isEqualTo(lesson.id());
        assertThat(request.studentId()).isEqualTo(lesson.studentId());
        assertThat(request.comment()).isEqualTo("Можно в пятницу?");
        assertRule(() -> ChangeRequest.open(UUID.randomUUID(), lesson, ChangeKind.RESCHEDULE, null, null, NOW),
                "schedule.proposed-time-invalid");
        assertRule(() -> ChangeRequest.open(UUID.randomUUID(), lesson, ChangeKind.RESCHEDULE, NOW, null, NOW),
                "schedule.proposed-time-invalid");
        assertRule(() -> ChangeRequest.open(UUID.randomUUID(), lesson, ChangeKind.CANCEL, START, null, NOW),
                "schedule.proposed-time-invalid");
    }

    @Test
    void onlyUpcomingPlannedLessonsAccept() {
        Lesson lesson = lesson();

        assertRule(() -> ChangeRequest.open(UUID.randomUUID(), lesson, ChangeKind.CANCEL, null, null, START),
                "schedule.request-not-allowed");
        lesson.cancel(CancelledBy.TEACHER, null, NOW);
        assertRule(() -> ChangeRequest.open(UUID.randomUUID(), lesson, ChangeKind.CANCEL, null, null, NOW),
                "schedule.request-not-allowed");
    }

    @Test
    void isAnsweredOnce() {
        ChangeRequest approved = ChangeRequest.open(UUID.randomUUID(), lesson(), ChangeKind.CANCEL, null, null, NOW);
        approved.approve(" Хорошо ", NOW);
        assertThat(approved.status()).isEqualTo(RequestStatus.APPROVED);
        assertThat(approved.resolutionComment()).isEqualTo("Хорошо");
        assertThat(approved.resolvedAt()).isEqualTo(NOW);
        assertRule(() -> approved.decline(null, NOW), "schedule.request-resolved");

        ChangeRequest declined = ChangeRequest.open(UUID.randomUUID(), lesson(), ChangeKind.CANCEL, null, null, NOW);
        declined.decline(null, NOW);
        assertThat(declined.status()).isEqualTo(RequestStatus.DECLINED);

        ChangeRequest withdrawn = ChangeRequest.open(UUID.randomUUID(), lesson(), ChangeKind.CANCEL, null, null, NOW);
        withdrawn.withdraw(NOW);
        assertThat(withdrawn.status()).isEqualTo(RequestStatus.WITHDRAWN);

        ChangeRequest outdated = ChangeRequest.open(UUID.randomUUID(), lesson(), ChangeKind.CANCEL, null, null, NOW);
        outdated.outdate(NOW);
        assertThat(outdated.status()).isEqualTo(RequestStatus.OUTDATED);
        outdated.markSaved(1);
        assertThat(outdated.version()).isEqualTo(1);
    }

    private static void assertRule(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}
