package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.TestUsers.admin;
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
    private static final String OPERATIONS_CSV = "/api/teacher/billing/operations.csv";

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
    void theCsvIsForTheTeacherOnly() {
        UUID me = directory.addStudent("Любопытный Csv");

        assertThat(mvc.get().uri(OPERATIONS_CSV).param("month", MONTH).with(student(me)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(OPERATIONS_CSV).param("month", MONTH).with(admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(OPERATIONS_CSV).param("month", MONTH)).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void theCsvHoldsTheFilteredJournalWithBomSemicolonsAndEscaping() throws Exception {
        UUID kira = directory.addStudent("Кира; \"Csv\"");
        UUID lena = directory.addStudent("Лена Csv");
        lesson(kira, "2031-03-05", LessonStatus.CONDUCTED);
        billing.recordPayment(new RecordPayment(kira, 123_450, LocalDate.parse("2031-03-10"), "аванс; \"март\""));
        UUID voided = payment(kira, "2031-03-11", 50_000);
        billing.voidPayment(voided, null);
        payment(lena, "2031-03-06", 1_000);

        var result = mvc.get().uri(OPERATIONS_CSV).param("month", MONTH).param("studentId", kira.toString())
                .with(teacher(directory.teacherId())).exchange();

        assertThat(result).hasStatusOk().hasContentTypeCompatibleWith("text/csv");
        assertThat(result.getResponse().getHeader("Content-Disposition"))
                .contains("attachment").contains("operations-2031-03.csv");
        byte[] body = result.getResponse().getContentAsByteArray();
        assertThat(body).startsWith(0xEF, 0xBB, 0xBF);
        String text = new String(body, 3, body.length - 3, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(text.lines().toList()).containsExactly(
                "Дата;Студент;Тип;Сумма;Комментарий;Отменено",
                "2031-03-11;\"Кира; \"\"Csv\"\"\";Оплата;0,00;;да",
                "2031-03-10;\"Кира; \"\"Csv\"\"\";Оплата;1234,50;\"аванс; \"\"март\"\"\";нет",
                "2031-03-05;\"Кира; \"\"Csv\"\"\";Урок;-1500,00;;нет");
    }

    @Test
    void theCsvNeutralisesSpreadsheetFormulasInTexts() throws Exception {
        UUID mila = directory.addStudent("Мила Формула");
        billing.recordPayment(new RecordPayment(mila, 1_000, LocalDate.parse("2031-03-08"), "=SUM(A1)"));

        var result = mvc.get().uri(OPERATIONS_CSV).param("month", MONTH).param("studentId", mila.toString())
                .with(teacher(directory.teacherId())).exchange();

        assertThat(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .contains(";'=SUM(A1);нет");
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
