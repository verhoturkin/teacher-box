package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.billing.application.GroupPriceService;
import ru.teacherbox.billing.persistence.GroupPriceRepository;
import ru.teacherbox.identity.api.GroupCreated;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Lesson prices of groups (ADR-0011). */
@BillingIntegrationTest
class GroupPricesIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    GroupPriceRepository prices;

    @Autowired
    GroupPriceService service;

    @Test
    void aNewGroupGetsTheDefaultPrice(Scenario scenario) {
        UUID group = groups.addGroup("ОГЭ");

        scenario.publish(new GroupCreated(group, "ОГЭ", List.of(), Instant.now()))
                .andWaitForStateChange(() -> prices.findById(group))
                .andVerify(price -> assertThat(price).get()
                        .extracting(found -> found.lessonPrice().amountMinor()).isEqualTo(150_000L));
        service.open(group);
        assertThat(prices.findById(group)).get().extracting(found -> found.version()).isEqualTo(0L);
    }

    @Test
    void theTeacherChangesThePrice() {
        UUID group = groups.addGroup("Английский");

        assertThat(changePrice(group, "{\"lessonPrice\":80000}")).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.groupId").isEqualTo(group.toString());
            assertThat(json).extractingPath("$.lessonPrice").isEqualTo(80_000);
        });
        assertThat(mvc.get().uri("/api/teacher/billing/groups").with(TestUsers.teacher(directory.teacherId())))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.currency").isEqualTo("RUB");
                    assertThat(json).extractingPath("$.prices[?(@.groupId == '%s')].lessonPrice".formatted(group))
                            .asArray().containsExactly(80_000);
                });
        assertThat(service.lessonPrice(group).amountMinor()).isEqualTo(80_000);
    }

    @Test
    void validatesThePriceAndTheGroup() {
        assertThat(changePrice(groups.addGroup("Г"), "{\"lessonPrice\":-1}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(changePrice(UUID.randomUUID(), "{\"lessonPrice\":1000}")).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("group.not-found");
    }

    @Test
    void aGroupWithoutAPriceIsChargedTheDefault() {
        assertThat(service.lessonPrice(UUID.randomUUID()).amountMinor()).isEqualTo(150_000);
    }

    @Test
    void studentsCannotChangePrices() {
        UUID student = directory.addStudent("Хитрый");
        assertThat(mvc.put().uri("/api/teacher/billing/groups/" + groups.addGroup("Г") + "/price")
                .with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"lessonPrice\":0}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult changePrice(UUID group, String json) {
        return mvc.put().uri("/api/teacher/billing/groups/" + group + "/price")
                .with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .exchange();
    }
}
