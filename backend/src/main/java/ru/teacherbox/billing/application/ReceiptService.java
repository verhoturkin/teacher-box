package ru.teacherbox.billing.application;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.domain.Payment;
import ru.teacherbox.billing.domain.Receipt;
import ru.teacherbox.billing.persistence.PaymentRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;

/**
 * Receipts of payments: the teacher attaches, replaces and removes them; the teacher and the student of the
 * payment download them. A receipt sent to the bot is kept as pending until its payment is recorded; pending
 * ones older than a day are removed.
 */
@Service
public class ReceiptService {

    static final Duration PENDING_TTL = Duration.ofDays(1);
    private static final Logger log = LoggerFactory.getLogger(ReceiptService.class);

    /** A receipt and its content. */
    public record ReceiptFile(Receipt receipt, Resource content) {
    }

    private final BillingService billing;
    private final PaymentRepository payments;
    private final FileStorage files;
    private final Clock clock;

    public ReceiptService(BillingService billing, PaymentRepository payments, FileStorage files, Clock clock) {
        this.billing = billing;
        this.payments = payments;
        this.files = files;
        this.clock = clock;
    }

    /**
     * Attaches a receipt to the payment, replacing the one before.
     *
     * @param size size of the content, if known in advance (a larger file is refused before it is stored)
     */
    @Transactional
    public PaymentView attach(UUID paymentId, String filename, long size, InputStream content) {
        Payment payment = load(paymentId);
        Receipt receipt = store(filename, size, content);
        try {
            payment.attachReceipt(receipt).ifPresent(previous -> deleteAfterCommit(previous.key()));
            payments.updateReceipt(payment);
        } catch (RuntimeException e) {
            files.delete(Receipt.NAMESPACE, receipt.key());
            throw e;
        }
        return PaymentView.of(payment);
    }

    @Transactional
    public PaymentView remove(UUID paymentId) {
        Payment payment = load(paymentId);
        Optional<Receipt> removed = payment.removeReceipt();
        if (removed.isPresent()) {
            payments.updateReceipt(payment);
            deleteAfterCommit(removed.get().key());
        }
        return PaymentView.of(payment);
    }

    /** The receipt of any payment, for the teacher. */
    @Transactional(readOnly = true)
    public ReceiptFile download(UUID paymentId) {
        return file(load(paymentId));
    }

    /** The receipt of the student's own payment; another student's payment is not found. */
    @Transactional(readOnly = true)
    public ReceiptFile downloadOwn(UUID studentId, UUID paymentId) {
        Payment payment = load(paymentId);
        if (!payment.studentId().equals(studentId)) {
            throw notFound();
        }
        return file(payment);
    }

    /** Keeps a receipt sent to the bot until its payment is recorded ({@link #recordWithPending}). */
    @Transactional
    public Receipt keepPending(String filename, byte[] content) {
        Receipt receipt = store(filename, content.length, new ByteArrayInputStream(content));
        payments.insertPendingReceipt(receipt.key(), clock.instant());
        return receipt;
    }

    /**
     * Records a payment with a receipt kept by {@link #keepPending}, both or neither.
     *
     * @throws BusinessRuleException if the receipt is no longer kept (attached already or removed)
     */
    @Transactional
    public PaymentView recordWithPending(BillingService.RecordPayment command, Receipt receipt) {
        Payment payment = load(billing.recordPayment(command).id());
        if (!payments.takePendingReceipt(receipt.key())) {
            throw new BusinessRuleException("receipt.gone", "The receipt is no longer kept");
        }
        payment.attachReceipt(receipt).ifPresent(previous -> deleteAfterCommit(previous.key()));
        payments.updateReceipt(payment);
        return PaymentView.of(payment);
    }

    @Scheduled(cron = "${teacherbox.billing.housekeeping-cron:0 25 4 * * *}",
            zone = "${teacherbox.timezone:Europe/Moscow}")
    void run() {
        purgePending(clock.instant());
    }

    /** Removes receipts sent to the bot whose payment was never recorded. @return how many */
    @Transactional
    public int purgePending(Instant now) {
        List<String> keys = payments.findPendingReceiptsBefore(now.minus(PENDING_TTL));
        for (String key : keys) {
            if (payments.takePendingReceipt(key)) {
                deleteAfterCommit(key);
            }
        }
        if (!keys.isEmpty()) {
            log.info("Housekeeping: removed {} receipts without a payment", keys.size());
        }
        return keys.size();
    }

    private Receipt store(String filename, long size, InputStream content) {
        if (size > Receipt.MAX_SIZE) {
            throw new BusinessRuleException("receipt.too-large", "A receipt must not exceed 10 MB");
        }
        BufferedInputStream buffered = new BufferedInputStream(content);
        byte[] head;
        try {
            buffered.mark(Receipt.HEAD_SIZE);
            head = buffered.readNBytes(Receipt.HEAD_SIZE);
            buffered.reset();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the receipt", e);
        }
        // the type and the size are checked before the file is kept
        Receipt.of("pending", filename, head, Math.max(size, head.length));
        StoredFile stored = files.store(Receipt.NAMESPACE, buffered);
        try {
            return Receipt.of(stored.key(), filename, head, stored.size());
        } catch (RuntimeException e) {
            files.delete(Receipt.NAMESPACE, stored.key());
            throw e;
        }
    }

    private ReceiptFile file(Payment payment) {
        Receipt receipt = payment.receipt();
        if (receipt == null) {
            throw new NotFoundException("receipt.not-found", "The payment has no receipt");
        }
        return new ReceiptFile(receipt, files.load(Receipt.NAMESPACE, receipt.key()));
    }

    private Payment load(UUID paymentId) {
        return payments.findById(paymentId).orElseThrow(ReceiptService::notFound);
    }

    private static NotFoundException notFound() {
        return new NotFoundException("payment.not-found", "Payment not found");
    }

    /** The file goes when the change is saved; a rolled back change keeps it. */
    private void deleteAfterCommit(String key) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            files.delete(Receipt.NAMESPACE, key);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                files.delete(Receipt.NAMESPACE, key);
            }
        });
    }
}
