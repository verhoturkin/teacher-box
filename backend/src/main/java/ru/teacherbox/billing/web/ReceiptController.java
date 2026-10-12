package ru.teacherbox.billing.web;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.application.ReceiptService;
import ru.teacherbox.billing.application.ReceiptService.ReceiptFile;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * Receipts of payments: the teacher attaches, removes and downloads them ({@code /api/teacher/**} requires the
 * teacher role); a student downloads the receipts of own payments.
 */
@RestController
class ReceiptController {

    private final ReceiptService receipts;

    ReceiptController(ReceiptService receipts) {
        this.receipts = receipts;
    }

    @PutMapping(path = "/api/teacher/billing/payments/{paymentId}/receipt",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    PaymentView attach(@PathVariable UUID paymentId, @RequestParam("file") MultipartFile file) throws IOException {
        String name = file.getOriginalFilename() == null ? file.getName() : file.getOriginalFilename();
        try (InputStream content = file.getInputStream()) {
            return receipts.attach(paymentId, name, file.getSize(), content);
        }
    }

    @DeleteMapping("/api/teacher/billing/payments/{paymentId}/receipt")
    PaymentView remove(@PathVariable UUID paymentId) {
        return receipts.remove(paymentId);
    }

    @GetMapping("/api/teacher/billing/payments/{paymentId}/receipt")
    ResponseEntity<Resource> download(@PathVariable UUID paymentId) {
        return response(receipts.download(paymentId));
    }

    @GetMapping("/api/me/billing/payments/{paymentId}/receipt")
    ResponseEntity<Resource> downloadOwn(CurrentUser user, @PathVariable UUID paymentId) {
        if (user.isTeacher()) {
            throw new ForbiddenException("billing.students-only", "Billing history is available to students only");
        }
        return response(receipts.downloadOwn(user.id(), paymentId));
    }

    /** Always a download, with the type recognized on upload and sniffing disabled. */
    private static ResponseEntity<Resource> response(ReceiptFile file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.receipt().contentType()))
                .contentLength(file.receipt().size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.receipt().filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(file.content());
    }
}
