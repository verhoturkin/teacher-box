package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Lessons, payments and balances through the teacher API. */
@BillingIntegrationTest
class LedgerIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    @Test
    void chargesLessonsWithDefaultPriceAndDuration(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Иван");

        MvcTestResult result = post("/api/teacher/billing/lessons",
                "{\"studentId\":\"%s\",\"date\":\"2026-09-01\",\"topic\":\"Дроби\"}".formatted(student));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.price").isEqualTo(150_000);
            assertThat(json).extractingPath("$.durationMinutes").isEqualTo(60);
            assertThat(json).extractingPath("$.status").isEqualTo("CONDUCTED");
            assertThat(json).extractingPath("$.topic").isEqualTo("Дроби");
        });
        assertThat(balance(student)).isEqualTo(-150_000);
        assertThat(events).contains(LessonRecorded.class)
                .matching(LessonRecorded::studentId, student)
                .matching(LessonRecorded::missed, false)
                .matching(event -> event.balanceAfter().amountMinor(), -150_000L);
    }

    @Test
    void chargesMissedLessonsWithCustomPrice(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Пётр");

        assertThat(post("/api/teacher/billing/lessons", """
                {"studentId":"%s","date":"2026-09-02","price":90000,"durationMinutes":45,"status":"MISSED"}
                """.formatted(student)))
                .hasStatus(HttpStatus.CREATED)
                .bodyJson().extractingPath("$.status").isEqualTo("MISSED");

        assertThat(balance(student)).isEqualTo(-90_000);
        assertThat(events).contains(LessonRecorded.class)
                .matching(LessonRecorded::studentId, student)
                .matching(LessonRecorded::missed, true)
                .matching(LessonRecorded::durationMinutes, 45);
    }

    @Test
    void paymentsIncreaseTheBalanceAndCanBeVoided(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Ольга");
        post("/api/teacher/billing/lessons", "{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(student));

        MvcTestResult payment = post("/api/teacher/billing/payments", """
                {"studentId":"%s","amount":500000,"paidOn":"2026-09-03","method":"TRANSFER","comment":"за месяц"}
                """.formatted(student));

        assertThat(payment).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.method").isEqualTo("TRANSFER");
        assertThat(balance(student)).isEqualTo(350_000);
        assertThat(events).contains(PaymentRecorded.class)
                .matching(PaymentRecorded::studentId, student)
                .matching(event -> event.balanceAfter().amountMinor(), 350_000L);

        String paymentId = JsonPath.read(body(payment), "$.id");
        assertThat(post("/api/teacher/billing/payments/" + paymentId + "/void", "{\"reason\":\"ошибка\"}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.voidReason").isEqualTo("ошибка");
        assertThat(balance(student)).isEqualTo(-150_000);
        assertThat(events).contains(PaymentVoided.class)
                .matching(PaymentVoided::amount, Money.of(500_000, java.util.Currency.getInstance("RUB")));

        assertThat(mvc.post().uri("/api/teacher/billing/payments/" + paymentId + "/void").with(teacher()))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("payment.already-voided");
    }

    @Test
    void cancelledLessonsAreNotCharged(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Вера");
        MvcTestResult lesson = post("/api/teacher/billing/lessons",
                "{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(student));
        String lessonId = JsonPath.read(body(lesson), "$.id");

        assertThat(mvc.post().uri("/api/teacher/billing/lessons/" + lessonId + "/cancel").with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("CANCELLED");

        assertThat(balance(student)).isZero();
        assertThat(events).contains(LessonCancelled.class).matching(LessonCancelled::studentId, student);
        assertThat(post("/api/teacher/billing/lessons/" + lessonId + "/cancel", "{}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("lesson.already-cancelled");
    }

    @Test
    void lessonPriceIsUsedForNewLessons() {
        UUID student = directory.addStudent("Лена");

        assertThat(put("/api/teacher/billing/students/" + student + "/price", "{\"lessonPrice\":200000}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.lessonPrice").isEqualTo(200_000);
        post("/api/teacher/billing/lessons", "{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(student));

        assertThat(balance(student)).isEqualTo(-200_000);
        assertThat(put("/api/teacher/billing/students/" + student + "/price", "{\"lessonPrice\":-1}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void ledgerListsEntriesNewestFirst() {
        UUID student = directory.addStudent("Хронология");
        post("/api/teacher/billing/lessons", "{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(student));
        post("/api/teacher/billing/lessons", "{\"studentId\":\"%s\",\"date\":\"2026-09-08\"}".formatted(student));
        post("/api/teacher/billing/payments", """
                {"studentId":"%s","amount":100000,"paidOn":"2026-09-05","method":"CASH"}
                """.formatted(student));

        assertThat(get("/api/teacher/billing/students/" + student)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.currency").isEqualTo("RUB");
            assertThat(json).extractingPath("$.displayName").isEqualTo("Хронология");
            assertThat(json).extractingPath("$.lessonPrice").isEqualTo(150_000);
            assertThat(json).extractingPath("$.charged").isEqualTo(300_000);
            assertThat(json).extractingPath("$.paid").isEqualTo(100_000);
            assertThat(json).extractingPath("$.balance").isEqualTo(-200_000);
            assertThat(json).extractingPath("$.lessons[*].date").asArray().containsExactly("2026-09-08", "2026-09-01");
            assertThat(json).extractingPath("$.payments[0].method").isEqualTo("CASH");
        });
    }

    @Test
    void validatesRequests() {
        UUID student = directory.addStudent("Валидация");

        assertThat(post("/api/teacher/billing/lessons",
                "{\"studentId\":\"%s\",\"date\":\"2026-09-01\",\"durationMinutes\":0}".formatted(student)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("/api/teacher/billing/lessons", "{\"studentId\":\"%s\"}".formatted(student)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("/api/teacher/billing/payments", """
                {"studentId":"%s","amount":0,"paidOn":"2026-09-01","method":"CASH"}
                """.formatted(student)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("payment.amount-invalid");
        assertThat(post("/api/teacher/billing/payments", """
                {"studentId":"%s","amount":100,"paidOn":"2026-09-01"}
                """.formatted(student)))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void unknownStudentsAndEntriesAreNotFound() {
        UUID unknown = UUID.randomUUID();

        assertThat(post("/api/teacher/billing/lessons",
                "{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(unknown)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        assertThat(get("/api/teacher/billing/students/" + unknown)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(post("/api/teacher/billing/lessons/" + unknown + "/cancel", "{}"))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("lesson.not-found");
        assertThat(post("/api/teacher/billing/payments/" + unknown + "/void", "{}"))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("payment.not-found");
    }

    private long balance(UUID student) {
        MvcTestResult result = get("/api/teacher/billing/students/" + student);
        assertThat(result).hasStatusOk();
        Number balance = JsonPath.read(body(result), "$.balance");
        return balance.longValue();
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).with(teacher()).exchange();
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString();
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
