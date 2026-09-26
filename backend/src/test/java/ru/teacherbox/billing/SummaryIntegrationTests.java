package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.TestUsers.student;
import static ru.teacherbox.testing.TestUsers.teacher;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingService.RecordLesson;
import ru.teacherbox.billing.application.BillingService.RecordPayment;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.domain.PaymentMethod;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.testing.FakeUserDirectory;

/** Home page counters: debts and income of the month, a student's balance. */
@BillingIntegrationTest
class SummaryIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    BillingService billing;

    @Autowired
    InstanceTimeZone timeZone;

    @Autowired
    Clock clock;

    @Test
    void theTeacherSeesDebtsAndTheIncomeOfTheMonth() throws UnsupportedEncodingException {
        String before = summary();
        LocalDate today = timeZone.today(clock);
        UUID bigDebtor = directory.addStudent("Большой долг");
        IntStream.range(0, 12).forEach(i -> lesson(bigDebtor, today.minusMonths(2)));
        UUID payer = directory.addStudent("Платит вперёд");
        payment(payer, today, 500_000);
        billing.voidPayment(payment(payer, today, 70_000), null);
        payment(payer, today.minusMonths(1).withDayOfMonth(1), 100_000);

        String after = summary();

        assertThat(number(after, "$.totalDebt")).isEqualTo(number(before, "$.totalDebt") + 12 * 150_000);
        assertThat(number(after, "$.debtors")).isEqualTo(number(before, "$.debtors") + 1);
        assertThat(number(after, "$.income")).isEqualTo(number(before, "$.income") + 500_000);
        assertThat(JsonPath.<String>read(after, "$.topDebtors[0].studentId")).isEqualTo(bigDebtor.toString());
        assertThat(JsonPath.<Integer>read(after, "$.topDebtors[0].balance")).isEqualTo(-12 * 150_000);
        assertThat(JsonPath.<String>read(after, "$.topDebtors[0].displayName")).isEqualTo("Большой долг");
        assertThat(JsonPath.<String>read(after, "$.month")).isEqualTo(today.toString().substring(0, 7));
        assertThat(JsonPath.<Boolean>read(after, "$.priceSet")).isTrue();
        assertThat(JsonPath.<String>read(after, "$.currency")).isEqualTo("RUB");
    }

    @Test
    void aStudentSeesTheBalanceAndTheLatestPayment() {
        UUID me = directory.addStudent("Мой баланс");
        lesson(me, LocalDate.parse("2026-09-01"));
        payment(me, LocalDate.parse("2026-09-02"), 100_000);
        billing.voidPayment(payment(me, LocalDate.parse("2026-09-05"), 30_000), "ошибка");
        payment(me, LocalDate.parse("2026-08-20"), 20_000);

        assertThat(mvc.get().uri("/api/me/billing/summary").with(student(me)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.balance").isEqualTo(-30_000);
                    assertThat(json).extractingPath("$.lessonPrice").isEqualTo(150_000);
                    assertThat(json).extractingPath("$.lastPayment.amount").isEqualTo(100_000);
                    assertThat(json).extractingPath("$.lastPayment.paidOn").isEqualTo("2026-09-02");
                });

        UUID newcomer = directory.addStudent("Без оплат");
        assertThat(mvc.get().uri("/api/me/billing/summary").with(student(newcomer)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.lastPayment").isNull();
    }

    @Test
    void summariesRespectRoles() {
        UUID me = directory.addStudent("Любопытный");

        assertThat(mvc.get().uri("/api/teacher/billing/summary").with(student(me))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/billing/summary").with(teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().extractingPath("$.code").isEqualTo("billing.students-only");
    }

    private String summary() throws UnsupportedEncodingException {
        MvcTestResult result = mvc.get().uri("/api/teacher/billing/summary").with(teacher(directory.teacherId()))
                .exchange();
        assertThat(result).hasStatusOk();
        return result.getResponse().getContentAsString();
    }

    private static long number(String json, String path) {
        return JsonPath.<Number>read(json, path).longValue();
    }

    private void lesson(UUID student, LocalDate date) {
        billing.recordLesson(new RecordLesson(student, date, null, null, null, LessonStatus.CONDUCTED));
    }

    private UUID payment(UUID student, LocalDate date, long amount) {
        return billing.recordPayment(new RecordPayment(student, amount, date, PaymentMethod.CARD, null)).id();
    }
}
