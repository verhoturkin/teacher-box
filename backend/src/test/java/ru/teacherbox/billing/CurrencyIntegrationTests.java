package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.application.BillingCurrencySetting;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/**
 * The instance currency, set by the teacher (ADR-0056) until the first charge or payment. Each test runs in a
 * transaction rolled back afterwards, so it can start from an instance without operations.
 */
@BillingIntegrationTest
@Transactional
class CurrencyIntegrationTests {

    private static final String URI = "/api/teacher/billing/currency";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    BillingService billing;

    @Autowired
    BillingCurrencySetting currency;

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void readTheStoredCurrencyAgain() {
        currency.forget();
    }

    @Test
    void theCurrencyChangesUntilTheFirstPaymentAndIsInForceAtOnce() {
        noOperations();
        assertThat(mvc.get().uri(URI).with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.currency").isEqualTo("RUB");
            assertThat(json).extractingPath("$.locked").isEqualTo(false);
        });

        assertThat(change("{\"currency\":\"eur\"}", teacher())).hasStatusOk()
                .bodyJson().extractingPath("$.currency").isEqualTo("EUR");
        assertThat(mvc.get().uri("/api/teacher/billing/overview").with(teacher()))
                .hasStatusOk().bodyJson().extractingPath("$.currency").isEqualTo("EUR");

        UUID student = directory.addStudent("Евро");
        billing.openAccount(student);
        assertThat(mvc.post().uri("/api/teacher/billing/payments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"%s\",\"amount\":5000,\"paidOn\":\"2026-09-01\"}".formatted(student)))
                .hasStatus(HttpStatus.CREATED);

        assertThat(mvc.get().uri(URI).with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$.locked").isEqualTo(true);
        assertThat(change("{\"currency\":\"USD\"}", teacher())).hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("billing.currency-locked");
        assertThat(change("{\"currency\":\"EUR\"}", teacher())).as("the same currency again").hasStatusOk();
    }

    @Test
    void aChargedLessonLocksTheCurrencyToo() {
        noOperations();
        UUID student = directory.addStudent("Урок");
        billing.openAccount(student);
        assertThat(mvc.post().uri("/api/teacher/billing/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(student)))
                .hasStatus(HttpStatus.CREATED);

        assertThat(change("{\"currency\":\"USD\"}", teacher())).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void anUnknownCurrencyIsRefused() {
        assertThat(change("{\"currency\":\"XXY\"}", teacher())).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("billing.currency-invalid");
        assertThat(change("{\"currency\":\"XAU\"}", teacher())).as("no minor units")
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(change("{\"currency\":\"€1\"}", teacher())).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(change("{\"currency\":\"\"}", teacher())).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(change("{\"currency\":\"EURO\"}", teacher())).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void anUnreadableStoredCurrencyIsTheDefault() {
        jdbc.sql("update billing.settings set currency = 'ZZZ' where id = 1").update();
        currency.forget();

        assertThat(currency.current()).isEqualTo(BillingCurrencySetting.DEFAULT);
    }

    @Test
    void onlyTheTeacherSeesAndChangesTheCurrency() {
        RequestPostProcessor student = TestUsers.student(UUID.randomUUID());
        assertThat(mvc.get().uri(URI).with(student)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(change("{\"currency\":\"EUR\"}", student)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(change("{\"currency\":\"EUR\"}", TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void aLessonRecordedByHandTakesTheLengthOfTheStudentsLastLesson() {
        UUID student = directory.addStudent("Длина");
        billing.openAccount(student);
        assertThat(lesson("{\"studentId\":\"%s\",\"date\":\"2026-09-01\"}".formatted(student)))
                .bodyJson().extractingPath("$.durationMinutes").isEqualTo(BillingService.DEFAULT_DURATION);
        assertThat(lesson("{\"studentId\":\"%s\",\"date\":\"2026-09-02\",\"durationMinutes\":45}".formatted(student)))
                .bodyJson().extractingPath("$.durationMinutes").isEqualTo(45);
        assertThat(lesson("{\"studentId\":\"%s\",\"date\":\"2026-09-03\"}".formatted(student)))
                .bodyJson().extractingPath("$.durationMinutes").isEqualTo(45);
    }

    private void noOperations() {
        jdbc.sql("delete from billing.lessons").update();
        jdbc.sql("delete from billing.payments").update();
    }

    private MvcTestResult lesson(String body) {
        return mvc.post().uri("/api/teacher/billing/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult change(String body, RequestPostProcessor user) {
        return mvc.put().uri(URI).with(user).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
