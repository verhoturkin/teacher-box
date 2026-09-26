package ru.teacherbox.billing.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.money.Money;

/** Price of a group lesson, charged to every participant (ADR-0011). */
public final class GroupPrice {

    private final UUID groupId;
    private Money lessonPrice;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private GroupPrice(UUID groupId, Money lessonPrice, Instant createdAt, Instant updatedAt, long version) {
        this.groupId = Objects.requireNonNull(groupId);
        this.lessonPrice = Objects.requireNonNull(lessonPrice);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    public static GroupPrice open(UUID groupId, Money lessonPrice, Instant now) {
        requireValidPrice(lessonPrice);
        return new GroupPrice(groupId, lessonPrice, now, now, 0);
    }

    public static GroupPrice restore(UUID groupId, Money lessonPrice, Instant createdAt, Instant updatedAt,
            long version) {
        return new GroupPrice(groupId, lessonPrice, createdAt, updatedAt, version);
    }

    public void change(Money newPrice, Instant now) {
        requireValidPrice(newPrice);
        lessonPrice = newPrice;
        updatedAt = now;
    }

    /** Called by the repository after the price has been saved with a new version. */
    public void markSaved(long newVersion) {
        version = newVersion;
    }

    private static void requireValidPrice(Money price) {
        if (price.isNegative()) {
            throw new BusinessRuleException("account.price-invalid", "Lesson price must not be negative");
        }
    }

    public UUID groupId() {
        return groupId;
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
