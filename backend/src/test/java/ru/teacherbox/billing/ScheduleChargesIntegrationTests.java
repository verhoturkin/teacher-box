package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.modulith.test.Scenario;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.domain.Lesson;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.persistence.LessonRepository;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;
import ru.teacherbox.testing.FakeUserDirectory;

/** Outcomes marked in the schedule are charged once and revoked with their outcome. */
@BillingIntegrationTest
class ScheduleChargesIntegrationTests {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 1);

    @Autowired
    LessonRepository lessons;

    @Autowired
    BillingService billing;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void chargesAMarkedLessonAtTheStudentsPrice(Scenario scenario) {
        UUID student = directory.addStudent("По расписанию");
        billing.openAccount(student);
        LessonCompleted completed = new LessonCompleted(UUID.randomUUID(), UUID.randomUUID(), student, DAY, 45,
                "Дроби", false, Instant.now());

        scenario.publish(completed)
                .andWaitForStateChange(() -> lessons.findByStudent(student), list -> !list.isEmpty())
                .andVerify(list -> {
                    Lesson lesson = list.getFirst();
                    assertThat(lesson.date()).isEqualTo(DAY);
                    assertThat(lesson.durationMinutes()).isEqualTo(45);
                    assertThat(lesson.price().amountMinor()).isEqualTo(150_000);
                    assertThat(lesson.topic()).isEqualTo("Дроби");
                    assertThat(lesson.status()).isEqualTo(LessonStatus.CONDUCTED);
                });

        billing.recordScheduledLesson(completed);
        assertThat(lessons.findByStudent(student)).as("the same outcome is charged once").hasSize(1);
    }

    @Test
    void revokedOutcomeCancelsTheCharge(Scenario scenario) {
        UUID student = directory.addStudent("Передумали");
        billing.openAccount(student);
        UUID completion = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        billing.recordScheduledLesson(new LessonCompleted(completion, lessonId, student, DAY, 60, null, true,
                Instant.now()));
        assertThat(lessons.findByStudent(student).getFirst().status()).isEqualTo(LessonStatus.MISSED);

        scenario.publish(new LessonCompletionRevoked(completion, lessonId, student, Instant.now()))
                .andWaitForStateChange(() -> statuses(student), list -> list.contains(LessonStatus.CANCELLED))
                .andVerify(list -> assertThat(list).containsExactly(LessonStatus.CANCELLED));

        Lesson cancelled = lessons.findByStudent(student).getFirst();
        assertThat(cancelled.cancelReason()).isEqualTo("Итог занятия изменён в расписании");
        billing.revokeScheduledLesson(new LessonCompletionRevoked(completion, lessonId, student, Instant.now()));
        billing.revokeScheduledLesson(new LessonCompletionRevoked(UUID.randomUUID(), lessonId, student,
                Instant.now()));
        assertThat(statuses(student)).as("revoking twice or an unknown outcome changes nothing")
                .containsExactly(LessonStatus.CANCELLED);
    }

    private List<LessonStatus> statuses(UUID student) {
        return lessons.findByStudent(student).stream().map(Lesson::status).toList();
    }
}
