package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.TestUsers.student;
import static ru.teacherbox.testing.TestUsers.teacher;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingService.RecordLesson;
import ru.teacherbox.billing.application.BillingService.RecordPayment;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.domain.PaymentMethod;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeUserDirectory;

/** Overview, monthly report and the student's personal view. */
@BillingIntegrationTest
class ReportsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    BillingService billing;

    @Test
    void overviewShowsBalancesAndTotals() {
        UUID debtor = directory.addStudent("Должник");
        UUID prepaid = directory.addStudent("Аванс");
        UUID former = directory.addStudent("Бывший");
        UUID idle = directory.addStudent("Без занятий");
        lesson(debtor, "2026-09-01", LessonStatus.CONDUCTED);
        payment(prepaid, "2026-09-01", 300_000);
        lesson(former, "2026-08-01", LessonStatus.CONDUCTED);
        directory.setStatus(former, StudentStatus.DEACTIVATED);

        assertThat(mvc.get().uri("/api/teacher/billing/overview").with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.currency").isEqualTo("RUB");
                    assertThat(json).extractingPath("$.defaultLessonPrice").isEqualTo(150_000);
                    assertThat(json).extractingPath("$.defaultLessonDuration").isEqualTo(60);
                    assertThat(json).extractingPath(row(debtor, "balance")).asArray().containsExactly(-150_000);
                    assertThat(json).extractingPath(row(debtor, "lastLessonDate")).asArray()
                            .containsExactly("2026-09-01");
                    assertThat(json).extractingPath(row(prepaid, "balance")).asArray().containsExactly(300_000);
                    assertThat(json).extractingPath(row(former, "status")).asArray().containsExactly("DEACTIVATED");
                    assertThat(json).extractingPath(row(idle, "balance")).asArray().containsExactly(0);
                    assertThat(json).extractingPath(row(idle, "lessonPrice")).asArray().containsExactly(150_000);
                });
    }

    @Test
    void monthlyReportAggregatesTheMonth() {
        UUID anna = directory.addStudent("Анна-отчёт");
        UUID boris = directory.addStudent("Борис-отчёт");
        lesson(anna, "2025-03-03", LessonStatus.CONDUCTED);
        lesson(anna, "2025-03-10", LessonStatus.MISSED);
        UUID cancelled = lesson(boris, "2025-03-12", LessonStatus.CONDUCTED);
        billing.cancelLesson(cancelled, "болел");
        lesson(boris, "2025-04-01", LessonStatus.CONDUCTED);
        payment(anna, "2025-03-15", 200_000);
        UUID voided = payment(boris, "2025-03-20", 100_000);
        billing.voidPayment(voided, null);

        assertThat(mvc.get().uri("/api/teacher/billing/reports/monthly?month=2025-03")
                .with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.month").isEqualTo("2025-03");
                    assertThat(json).extractingPath("$.income").isEqualTo(200_000);
                    assertThat(json).extractingPath("$.charged").isEqualTo(300_000);
                    assertThat(json).extractingPath("$.conductedLessons").isEqualTo(1);
                    assertThat(json).extractingPath("$.missedLessons").isEqualTo(1);
                    assertThat(json).extractingPath("$.cancelledLessons").isEqualTo(1);
                    assertThat(json).extractingPath("$.students[*].displayName").asArray()
                            .containsExactly("Анна-отчёт");
                    assertThat(json).extractingPath("$.students[0].chargedLessons").isEqualTo(2);
                    assertThat(json).extractingPath("$.lessons.length()").isEqualTo(3);
                    assertThat(json).extractingPath("$.lessons[0].studentName").isEqualTo("Борис-отчёт");
                    assertThat(json).extractingPath("$.payments.length()").isEqualTo(2);
                });
    }

    @Test
    void monthlyReportRequiresValidMonth() {
        assertThat(mvc.get().uri("/api/teacher/billing/reports/monthly?month=2025-13")
                .with(teacher(directory.teacherId())))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void studentSeesOnlyOwnLedger() {
        UUID me = directory.addStudent("Я сам");
        UUID other = directory.addStudent("Другой");
        lesson(me, "2026-09-01", LessonStatus.CONDUCTED);
        lesson(other, "2026-09-01", LessonStatus.CONDUCTED);

        assertThat(mvc.get().uri("/api/me/billing").with(student(me)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.studentId").isEqualTo(me.toString());
                    assertThat(json).extractingPath("$.lessons.length()").isEqualTo(1);
                    assertThat(json).extractingPath("$.balance").isEqualTo(-150_000);
                });
        assertThat(mvc.get().uri("/api/teacher/billing/students/" + other).with(student(me)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/billing/overview").with(student(me)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void teacherHasNoPersonalLedger() {
        assertThat(mvc.get().uri("/api/me/billing").with(teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().extractingPath("$.code").isEqualTo("billing.students-only");
    }

    @Test
    void anonymousIsRejected() {
        assertThat(mvc.get().uri("/api/me/billing")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/teacher/billing/overview")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private UUID lesson(UUID student, String date, LessonStatus status) {
        return billing.recordLesson(new RecordLesson(student, LocalDate.parse(date), null, null, null, status)).id();
    }

    private UUID payment(UUID student, String date, long amount) {
        return billing.recordPayment(new RecordPayment(student, amount, LocalDate.parse(date), PaymentMethod.CARD,
                null)).id();
    }

    private static String row(UUID student, String field) {
        return "$.students[?(@.studentId == '%s')].%s".formatted(student, field);
    }
}
