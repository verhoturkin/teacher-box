package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jayway.jsonpath.JsonPath;
import java.io.ByteArrayInputStream;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.billing.application.BillingService.RecordPayment;
import ru.teacherbox.billing.application.ReceiptService;
import ru.teacherbox.billing.domain.Receipt;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Receipts of payments: attached by the teacher in the portal or through the bot, downloaded by the student. */
@BillingIntegrationTest
class ReceiptsIntegrationTests {

    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 'I', 'H', 'D', 'R'};
    static final byte[] PDF = "%PDF-1.7 receipt".getBytes(StandardCharsets.US_ASCII);

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ReceiptService receipts;

    @Autowired
    FileStorage files;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherAttachesReplacesAndRemovesAReceipt() throws Exception {
        UUID student = directory.addStudent("Чек");
        String payment = payment(student);

        MvcTestResult attached = upload(payment, new MockMultipartFile("file", "Чек от 01.10", "image/png", PNG));
        assertThat(attached).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.receipt.filename").isEqualTo("Чек от 01.10.png");
            assertThat(json).extractingPath("$.receipt.contentType").isEqualTo("image/png");
            assertThat(json).extractingPath("$.receipt.size").isEqualTo(PNG.length);
        });
        MvcTestResult download = mvc.get().uri("/api/teacher/billing/payments/" + payment + "/receipt")
                .with(teacher()).exchange();
        assertThat(download).hasStatusOk().hasContentType(MediaType.IMAGE_PNG);
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(PNG);
        assertThat(download.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION)).startsWith("attachment");

        assertThat(upload(payment, new MockMultipartFile("file", "bank.PDF", "image/png", PDF)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.receipt.filename").isEqualTo("bank.pdf");
                    assertThat(json).extractingPath("$.receipt.contentType").isEqualTo("application/pdf");
                });
        assertThat(mvc.get().uri("/api/me/billing").with(TestUsers.student(student)))
                .bodyJson().extractingPath("$.payments[0].receipt.filename").isEqualTo("bank.pdf");

        assertThat(mvc.delete().uri("/api/teacher/billing/payments/" + payment + "/receipt").with(teacher()))
                .hasStatusOk().bodyJson().extractingPath("$.receipt").isNull();
        assertThat(mvc.get().uri("/api/teacher/billing/payments/" + payment + "/receipt").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("receipt.not-found");
        assertThat(mvc.delete().uri("/api/teacher/billing/payments/" + payment + "/receipt").with(teacher()))
                .hasStatusOk();
    }

    @Test
    void onlyPicturesAndPdfsUpTo10MbAreReceipts() throws Exception {
        String payment = payment(directory.addStudent("Не чек"));

        assertThat(upload(payment, new MockMultipartFile("file", "note.png", "image/png",
                "just text".getBytes(StandardCharsets.UTF_8))))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("receipt.type-not-allowed");
        assertThat(upload(payment, new MockMultipartFile("file", "big.pdf", "application/pdf",
                new byte[(int) Receipt.MAX_SIZE + 1])))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("receipt.too-large");
        assertThat(upload(UUID.randomUUID().toString(), new MockMultipartFile("file", "a.pdf", "application/pdf",
                PDF)))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aStudentDownloadsOnlyOwnReceipts() throws Exception {
        UUID owner = directory.addStudent("Владелец");
        UUID other = directory.addStudent("Другой");
        String payment = payment(owner);
        upload(payment, new MockMultipartFile("file", "receipt.pdf", "application/pdf", PDF));

        MvcTestResult own = mvc.get().uri("/api/me/billing/payments/" + payment + "/receipt")
                .with(TestUsers.student(owner)).exchange();
        assertThat(own).hasStatusOk().hasContentType(MediaType.APPLICATION_PDF);
        assertThat(own.getResponse().getContentAsByteArray()).isEqualTo(PDF);

        assertThat(mvc.get().uri("/api/me/billing/payments/" + payment + "/receipt").with(TestUsers.student(other)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/billing/payments/" + payment + "/receipt").with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .multipart(HttpMethod.PUT, "/api/teacher/billing/payments/" + payment + "/receipt")
                .file(new MockMultipartFile("file", "x.pdf", "application/pdf", PDF))
                .with(TestUsers.student(owner))))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/billing/payments/" + payment + "/receipt")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aReceiptSentToTheBotWaitsForItsPayment() {
        UUID student = directory.addStudent("Из бота");
        Receipt receipt = receipts.keepPending("photo.jpg", PDF);
        assertThat(receipt.filename()).isEqualTo("photo.pdf");

        var payment = receipts.recordWithPending(new RecordPayment(student, 100_000, LocalDate.of(2026, 10, 1), null),
                receipt);

        assertThat(payment.receipt()).isNotNull();
        assertThat(receipts.downloadOwn(student, payment.id()).receipt().key()).isEqualTo(receipt.key());
        assertThatThrownBy(() -> receipts.recordWithPending(
                new RecordPayment(student, 100_000, LocalDate.of(2026, 10, 1), null), receipt))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "receipt.gone");
    }

    @Test
    void forgottenReceiptsOfTheBotAreRemovedAfterADay() {
        Receipt forgotten = receipts.keepPending("photo.png", PNG);
        receipts.purgePending(clock.instant().plus(Duration.ofHours(1)));
        assertThat(files.load(Receipt.NAMESPACE, forgotten.key()).exists()).isTrue();

        assertThat(receipts.purgePending(clock.instant().plus(Duration.ofDays(2)))).isPositive();

        assertThatThrownBy(() -> files.load(Receipt.NAMESPACE, forgotten.key())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> receipts.keepPending("empty.png", new byte[0]))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "receipt.empty");
        assertThatThrownBy(() -> receipts.attach(UUID.randomUUID(), "a.pdf", PDF.length, new ByteArrayInputStream(PDF)))
                .isInstanceOf(NotFoundException.class);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult upload(String payment, MockMultipartFile file) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .multipart(HttpMethod.PUT, "/api/teacher/billing/payments/" + payment + "/receipt")
                .file(file)
                .with(teacher()));
    }

    private String payment(UUID student) throws UnsupportedEncodingException {
        MvcTestResult result = mvc.post().uri("/api/teacher/billing/payments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"%s\",\"amount\":150000,\"paidOn\":\"2026-10-01\"}".formatted(student))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }
}
