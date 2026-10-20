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
import ru.teacherbox.testing.FakeUserDirectory;

/** The journal of a month (payments, lessons, absences) and the weekly totals of the summary. */
@BillingIntegrationTest
class OperationsIntegrationTests {

    private static final String MONTH = "2031-03";
    private static final String OPERATIONS = "/api/teacher/billing/operations";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    BillingService billing;

    @Test
    void aStudentAndAnotherRoleAreForbidden() {
        UUID me = directory.addStudent("Любопытный");

        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH).with(student(me)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH)).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void theJournalListsPaymentsLessonsAndAbsencesOfTheMonthNewestFirst() {
        UUID anna = directory.addStudent("Анна Журнал");
        directory.setAvatar(anna, "/api/public/avatars/anna");
        lesson(anna, "2031-03-05", LessonStatus.CONDUCTED);
        lesson(anna, "2031-03-12", LessonStatus.MISSED);
        UUID cancelled = billing.recordLesson(new RecordLesson(anna, LocalDate.parse("2031-03-16"), null, null, null,
                LessonStatus.CONDUCTED)).id();
        billing.cancelLesson(cancelled, null);
        payment(anna, "2031-03-10", 600_000);
        lesson(anna, "2031-02-28", LessonStatus.CONDUCTED);
        payment(anna, "2031-04-01", 1_000);

        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH).with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.month").isEqualTo(MONTH);
                    assertThat(json).extractingPath("$.currency").isEqualTo("RUB");
                    assertThat(json).extractingPath("$.operations[?(@.studentId == '" + anna + "')].kind")
                            .asArray().containsExactly("ABSENCE", "ABSENCE", "PAYMENT", "LESSON");
                    assertThat(json).extractingPath("$.operations[?(@.studentId == '" + anna + "')].amount")
                            .asArray().containsExactly(0, -150_000, 600_000, -150_000);
                    assertThat(json).extractingPath("$.operations[?(@.studentId == '" + anna + "')].date")
                            .asArray().containsExactly("2031-03-16", "2031-03-12", "2031-03-10", "2031-03-05");
                    assertThat(json).extractingPath("$.operations[0].studentName").isEqualTo("Анна Журнал");
                    assertThat(json).extractingPath("$.operations[0].studentAvatar")
                            .isEqualTo("/api/public/avatars/anna");
                });
    }

    @Test
    void theKindAndTheStudentNarrowTheJournal() {
        UUID boris = directory.addStudent("Борис Фильтр");
        UUID vera = directory.addStudent("Вера Фильтр");
        lesson(boris, "2031-03-03", LessonStatus.CONDUCTED);
        lesson(boris, "2031-03-04", LessonStatus.MISSED);
        payment(boris, "2031-03-05", 100_000);
        payment(vera, "2031-03-06", 200_000);

        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH).param("kind", "PAYMENT")
                .param("studentId", boris.toString()).with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.operations").asArray().hasSize(1);
                    assertThat(json).extractingPath("$.operations[0].amount").isEqualTo(100_000);
                });
        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH).param("kind", "ABSENCE")
                .param("studentId", boris.toString()).with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.operations[0].status").isEqualTo("MISSED");
        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH).param("studentId", boris.toString())
                .with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.operations").asArray().hasSize(3);
    }

    @Test
    void aVoidedPaymentStaysInTheJournalMarkedVoid() {
        UUID dina = directory.addStudent("Дина Отмена");
        billing.voidPayment(payment(dina, "2031-03-07", 50_000), "ошибка");

        assertThat(mvc.get().uri(OPERATIONS).param("month", MONTH).param("studentId", dina.toString())
                .with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.operations[0].voided").isEqualTo(true);
                    assertThat(json).extractingPath("$.operations[0].amount").isEqualTo(0);
                });
    }

    @Test
    void theSummaryGivesWeeklyTotalsOfTheMonth() {
        UUID egor = directory.addStudent("Егор Недели");
        payment(egor, "2031-06-03", 1_000);
        payment(egor, "2031-06-05", 2_000);
        payment(egor, "2031-06-30", 4_000);
        billing.voidPayment(payment(egor, "2031-06-12", 8_000), null);
        lesson(egor, "2031-06-06", LessonStatus.CONDUCTED);

        assertThat(mvc.get().uri("/api/teacher/billing/summary").param("month", "2031-06")
                .with(teacher(directory.teacherId())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.month").isEqualTo("2031-06");
                    assertThat(json).extractingPath("$.weeks[*].from").asArray().containsExactly(
                            "2031-06-01", "2031-06-02", "2031-06-09", "2031-06-16", "2031-06-23", "2031-06-30");
                    assertThat(json).extractingPath("$.weeks[*].to").asArray().containsExactly(
                            "2031-06-01", "2031-06-08", "2031-06-15", "2031-06-22", "2031-06-29", "2031-06-30");
                    assertThat(json).extractingPath("$.weeks[*].income").asArray()
                            .containsExactly(0, 3_000, 0, 0, 0, 4_000);
                    assertThat(json).extractingPath("$.weeks[1].charged").isEqualTo(150_000);
                    assertThat(json).extractingPath("$.income").isEqualTo(7_000);
                });
    }

    private void lesson(UUID student, String date, LessonStatus status) {
        billing.recordLesson(new RecordLesson(student, LocalDate.parse(date), null, null, null, status));
    }

    private UUID payment(UUID student, String date, long amount) {
        return billing.recordPayment(new RecordPayment(student, amount, LocalDate.parse(date), null)).id();
    }
}
