package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.billing.application.PaymentVisibilityService;
import ru.teacherbox.identity.api.GuardianUnlinked;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** «Оплаты видит только родитель»: the teacher hides payments from a student who has a guardian (ADR-0069). */
@BillingIntegrationTest
class PaymentVisibilityIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeGuardians guardians;

    @Autowired
    PaymentVisibilityService visibility;

    @Autowired
    List<ChatAction> actions;

    @Test
    void theTeacherHidesPaymentsFromAStudentWithAGuardian() throws Exception {
        UUID child = directory.addStudent("Петя");
        guardians.addGuardian("Мама", child);
        String payment = payment(child);
        String path = "/api/teacher/billing/students/" + child + "/visibility";
        assertThat(mvc.get().uri(path).with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.studentId").isEqualTo(child.toString());
            assertThat(json).extractingPath("$.guardiansOnly").isEqualTo(false);
            assertThat(json).extractingPath("$.hasGuardians").isEqualTo(true);
        });
        assertThat(visible(child)).isTrue();

        assertThat(change(path, true)).hasStatusOk().bodyJson().extractingPath("$.guardiansOnly").isEqualTo(true);
        assertThat(change(path, true)).as("switching it on again").hasStatusOk();
        assertThat(mvc.get().uri(path).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.guardiansOnly").isEqualTo(true);

        assertThat(visible(child)).isFalse();
        for (String hidden : new String[] {"/api/me/billing", "/api/me/billing/summary",
                "/api/me/billing/payments/" + payment + "/receipt"}) {
            assertThat(mvc.get().uri(hidden).with(TestUsers.student(child))).hasStatus(HttpStatus.NOT_FOUND)
                    .bodyJson().extractingPath("$.code").isEqualTo("billing.hidden");
        }
        assertThat(mvc.get().uri("/api/teacher/billing/students/" + child).with(teacher()))
                .as("the teacher still sees everything").hasStatusOk();

        assertThat(change(path, false)).hasStatusOk().bodyJson().extractingPath("$.guardiansOnly").isEqualTo(false);
        assertThat(visible(child)).isTrue();
        assertThat(mvc.get().uri("/api/me/billing").with(TestUsers.student(child))).hasStatusOk();
    }

    @Test
    void aStudentWithoutAGuardianAlwaysSeesPayments() throws Exception {
        UUID adult = directory.addStudent("Взрослая");
        String path = "/api/teacher/billing/students/" + adult + "/visibility";

        assertThat(change(path, true)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("billing.no-guardian");
        assertThat(mvc.get().uri(path).with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.guardiansOnly").isEqualTo(false);
            assertThat(json).extractingPath("$.hasGuardians").isEqualTo(false);
        });
        assertThat(change(path, false)).as("switching off is always allowed").hasStatusOk();
        assertThat(visible(adult)).isTrue();
        assertThat(mvc.get().uri("/api/me/billing/summary").with(TestUsers.student(adult))).hasStatusOk();
    }

    @Test
    void unlinkingTheLastGuardianShowsPaymentsAgain(Scenario scenario) {
        UUID child = directory.addStudent("Оля");
        UUID mother = guardians.addGuardian("Мама", child);
        UUID father = guardians.addGuardian("Папа", child);
        visibility.change(child, true);

        guardians.unlink(mother, child);
        scenario.publish(new GuardianUnlinked(mother, child, true, Instant.now()))
                .andWaitForEventOfType(GuardianUnlinked.class).toArrive();
        assertThat(visibility.hiddenFromStudent(child)).as("one guardian is left").isTrue();

        guardians.unlink(father, child);
        assertThat(visibility.hiddenFromStudent(child)).as("no guardian, even before the event").isFalse();
        scenario.publish(new GuardianUnlinked(father, child, true, Instant.now()))
                .andWaitForStateChange(() -> visibility.of(child).guardiansOnly() ? null : Boolean.TRUE)
                .andVerify(switchedOff -> assertThat(switchedOff).isTrue());

        guardians.addGuardian("Новый опекун", child);
        assertThat(visibility.of(child).guardiansOnly()).as("a new guardian does not hide them again").isFalse();
        assertThat(visibility.hiddenFromStudent(child)).isFalse();
    }

    @Test
    void theBotHidesPaymentsFromTheStudentToo() {
        UUID child = directory.addStudent("Ваня");
        guardians.addGuardian("Бабушка", child);
        ChatAction payments = action(actions, "billing.payments");
        ChatUser user = new ChatUser(child, Role.STUDENT);
        assertThat(payments.availableTo(user)).isTrue();

        visibility.change(child, true);

        assertThat(payments.availableTo(user)).isFalse();
    }

    @Test
    void onlyTheTeacherSwitchesItAndOnlyAStudentAsksForIt() {
        UUID child = directory.addStudent("Саша");
        UUID parent = guardians.addGuardian("Родитель", child);
        String path = "/api/teacher/billing/students/" + child + "/visibility";
        for (RequestPostProcessor other : new RequestPostProcessor[] {TestUsers.student(child),
                TestUsers.guardian(parent)}) {
            assertThat(mvc.get().uri(path).with(other)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.put().uri(path).with(other).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"guardiansOnly\":false}")).hasStatus(HttpStatus.FORBIDDEN);
        }
        assertThat(mvc.get().uri("/api/me/billing/visible").with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/billing/visible").with(TestUsers.guardian(parent)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/billing/students/" + UUID.randomUUID() + "/visibility")
                .with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.put().uri(path).with(teacher()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    private boolean visible(UUID student) throws Exception {
        MvcTestResult result = mvc.get().uri("/api/me/billing/visible").with(TestUsers.student(student)).exchange();
        assertThat(result).hasStatusOk();
        return JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.visible");
    }

    private MvcTestResult change(String path, boolean guardiansOnly) {
        return mvc.put().uri(path).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"guardiansOnly\":%s}".formatted(guardiansOnly)).exchange();
    }

    private String payment(UUID student) throws Exception {
        MvcTestResult result = mvc.post().uri("/api/teacher/billing/payments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"%s\",\"amount\":150000,\"paidOn\":\"2026-10-01\"}".formatted(student))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
