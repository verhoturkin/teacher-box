package ru.teacherbox.billing.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.money.Money;

/** Billing settings of a student: the default price of a lesson. */
public final class StudentAccount {

    private final UUID studentId;
    private Money lessonPrice;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private StudentAccount(UUID studentId, Money lessonPrice, Instant createdAt, Instant updatedAt, long version) {
        this.studentId = Objects.requireNonNull(studentId);
        this.lessonPrice = Objects.requireNonNull(lessonPrice);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    public static StudentAccount open(UUID studentId, Money lessonPrice, Instant now) {
        requireValidPrice(lessonPrice);
        return new StudentAccount(studentId, lessonPrice, now, now, 0);
    }

    public static StudentAccount restore(UUID studentId, Money lessonPrice, Instant createdAt, Instant updatedAt,
            long version) {
        return new StudentAccount(studentId, lessonPrice, createdAt, updatedAt, version);
    }

    public void changeLessonPrice(Money newPrice, Instant now) {
        requireValidPrice(newPrice);
        lessonPrice = newPrice;
        updatedAt = now;
    }

    /** Called by the repository after the account has been saved with a new version. */
    public void markSaved(long newVersion) {
        version = newVersion;
    }

    private static void requireValidPrice(Money price) {
        if (price.isNegative()) {
            throw new BusinessRuleException("account.price-invalid", "Lesson price must not be negative");
        }
    }

    public UUID studentId() {
        return studentId;
    }

    public Money lessonPrice() {
        return lessonPrice;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public long version() {
        return version;
    }
}
