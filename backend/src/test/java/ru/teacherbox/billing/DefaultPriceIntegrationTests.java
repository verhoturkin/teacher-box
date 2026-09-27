package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.GroupPriceService;
import ru.teacherbox.billing.persistence.StudentAccountRepository;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The lesson price of new students and groups, set by the teacher (ADR-0014). */
@BillingIntegrationTest
class DefaultPriceIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    BillingService billing;

    @Autowired
    GroupPriceService groupPrices;

    @Autowired
    StudentAccountRepository accounts;

    @AfterEach
    void backToTheConfiguredPrice() {
        assertThat(change("{\"lessonPrice\":150000}", teacher())).hasStatusOk();
    }

    @Test
    void newStudentsAndGroupsGetThePriceTheTeacherSet() {
        UUID before = directory.addStudent("Раньше");
        billing.openAccount(before);

        assertThat(change("{\"lessonPrice\":200000}", teacher()))
                .hasStatusOk().bodyJson().extractingPath("$.lessonPrice").isEqualTo(200_000);

        UUID after = directory.addStudent("Позже");
        billing.openAccount(after);
        assertThat(accounts.findById(after)).get()
                .extracting(account -> account.lessonPrice().amountMinor()).isEqualTo(200_000L);
        assertThat(accounts.findById(before)).get().as("prices already given stay")
                .extracting(account -> account.lessonPrice().amountMinor()).isEqualTo(150_000L);
        assertThat(groupPrices.lessonPrice(groups.addGroup("Новая")).amountMinor()).isEqualTo(200_000L);
        assertThat(mvc.get().uri("/api/teacher/billing/overview").with(teacher()))
                .hasStatusOk().bodyJson().extractingPath("$.defaultLessonPrice").isEqualTo(200_000);
    }

    @Test
    void onlyTheTeacherSetsAPriceThatIsNotNegative() {
        assertThat(change("{\"lessonPrice\":-1}", teacher())).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(change("{}", teacher())).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(change("{\"lessonPrice\":100}", TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult change(String body, RequestPostProcessor user) {
        return mvc.put().uri("/api/teacher/billing/default-price").with(user)
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
