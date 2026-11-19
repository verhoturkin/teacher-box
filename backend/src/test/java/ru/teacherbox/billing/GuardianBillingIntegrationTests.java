package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.billing.application.PaymentVisibilityService;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** A guardian reads a child's balance, history and receipts as the child does (ADR-0069). */
@BillingIntegrationTest
class GuardianBillingIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeGuardians guardians;

    @Autowired
    PaymentVisibilityService visibility;

    @Test
    void aGuardianReadsTheChildsBalanceHistoryAndReceipt() throws Exception {
        UUID child = directory.addStudent("Маша");
        UUID parent = guardians.addGuardian("Анна", child);
        String payment = payment(child);
        assertThat(mvc.perform(MockMvcRequestBuilders
                .multipart(HttpMethod.PUT, "/api/teacher/billing/payments/" + payment + "/receipt")
                .file(new MockMultipartFile("file", "чек.png", "image/png", ReceiptsIntegrationTests.PNG))
                .with(teacher()))).hasStatusOk();
        String base = "/api/guardian/students/" + child + "/billing";

        assertThat(as(parent, base)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.payments[0].id").isEqualTo(payment);
            assertThat(json).extractingPath("$.payments[0].receipt.filename").isEqualTo("чек.png");
        });
        assertThat(as(parent, base + "/summary")).hasStatusOk();
        MvcTestResult receipt = as(parent, base + "/payments/" + payment + "/receipt");
        assertThat(receipt).hasStatusOk().hasContentType(MediaType.IMAGE_PNG)
                .hasHeader("X-Content-Type-Options", "nosniff");
        assertThat(receipt.getResponse().getContentAsByteArray()).isEqualTo(ReceiptsIntegrationTests.PNG);
    }

    @Test
    void theGuardianSeesPaymentsHiddenFromTheChild() throws Exception {
        UUID child = directory.addStudent("Скрытые оплаты");
        UUID parent = guardians.addGuardian("Плательщица", child);
        String payment = payment(child);
        assertThat(mvc.perform(MockMvcRequestBuilders
                .multipart(HttpMethod.PUT, "/api/teacher/billing/payments/" + payment + "/receipt")
                .file(new MockMultipartFile("file", "чек.png", "image/png", ReceiptsIntegrationTests.PNG))
                .with(teacher()))).hasStatusOk();
        visibility.change(child, true);
        assertThat(mvc.get().uri("/api/me/billing").with(TestUsers.student(child))).hasStatus(HttpStatus.NOT_FOUND);
        String base = "/api/guardian/students/" + child + "/billing";

        assertThat(as(parent, base)).hasStatusOk().bodyJson().extractingPath("$.payments[0].id").isEqualTo(payment);
        assertThat(as(parent, base + "/summary")).hasStatusOk();
        assertThat(as(parent, base + "/payments/" + payment + "/receipt")).hasStatusOk()
                .hasContentType(MediaType.IMAGE_PNG);
    }

    @Test
    void anotherStudentsBillingIsNotFoundAndOtherRolesAreForbidden() throws Exception {
        UUID child = directory.addStudent("Свой");
        UUID stranger = directory.addStudent("Чужой");
        UUID parent = guardians.addGuardian("Родитель", child);
        String foreignPayment = payment(stranger);
        String foreign = "/api/guardian/students/" + stranger + "/billing";

        for (String path : new String[] {"", "/summary", "/payments/" + foreignPayment + "/receipt"}) {
            assertThat(as(parent, foreign + path)).hasStatus(HttpStatus.NOT_FOUND)
                    .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        }
        assertThat(as(parent, "/api/guardian/students/" + child + "/billing/payments/" + foreignPayment + "/receipt"))
                .as("a payment of another student under one's own child").hasStatus(HttpStatus.NOT_FOUND);
        String own = "/api/guardian/students/" + child + "/billing";
        assertThat(mvc.get().uri(own).with(TestUsers.student(child))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(own).with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/billing").with(TestUsers.guardian(parent))).hasStatus(HttpStatus.FORBIDDEN);

        directory.setStatus(child, StudentStatus.DEACTIVATED);
        assertThat(as(parent, own + "/summary")).as("a deactivated child is hidden").hasStatus(HttpStatus.NOT_FOUND);
    }

    private String payment(UUID student) throws Exception {
        MvcTestResult result = mvc.post().uri("/api/teacher/billing/payments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"%s\",\"amount\":150000,\"paidOn\":\"2026-10-01\"}".formatted(student))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }

    private MvcTestResult as(UUID guardian, String uri) {
        return mvc.get().uri(uri).with(guardianUser(guardian)).exchange();
    }

    private static RequestPostProcessor guardianUser(UUID guardian) {
        return TestUsers.guardian(guardian);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
