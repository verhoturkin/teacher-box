package ru.teacherbox.billing.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.money.Money;

/**
 * A lesson in the log. A conducted or missed lesson is charged to the student. The log is never
 * rewritten: a wrong entry is cancelled (and stays visible) instead of being deleted.
 */
public final class Lesson {

    public static final int MAX_DURATION_MINUTES = 600;

    private final UUID id;
    private final UUID studentId;
    private final LocalDate date;
    private final int durationMinutes;
    private final Money price;
    private final @Nullable String topic;
    private LessonStatus status;
    private final Instant createdAt;
    private @Nullable Instant cancelledAt;
    private @Nullable String cancelReason;

    private Lesson(UUID id, UUID studentId, LocalDate date, int durationMinutes, Money price, @Nullable String topic,
            LessonStatus status, Instant createdAt, @Nullable Instant cancelledAt, @Nullable String cancelReason) {
        this.id = Objects.requireNonNull(id);
        this.studentId = Objects.requireNonNull(studentId);
        this.date = Objects.requireNonNull(date);
        this.durationMinutes = durationMinutes;
        this.price = Objects.requireNonNull(price);
        this.topic = topic;
        this.status = Objects.requireNonNull(status);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.cancelledAt = cancelledAt;
        this.cancelReason = cancelReason;
    }

    /**
     * @param status {@link LessonStatus#CONDUCTED} or {@link LessonStatus#MISSED}
     */
    public static Lesson record(UUID id, UUID studentId, LocalDate date, int durationMinutes, Money price,
            @Nullable String topic, LessonStatus status, Instant now) {
        if (durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES) {
            throw new BusinessRuleException("lesson.duration-invalid",
                    "Lesson duration must be 1-" + MAX_DURATION_MINUTES + " minutes");
        }
        if (price.isNegative()) {
            throw new BusinessRuleException("lesson.price-invalid", "Lesson price must not be negative");
        }
        if (!status.isCharged()) {
            throw new BusinessRuleException("lesson.status-invalid", "A new lesson must be conducted or missed");
        }
        return new Lesson(id, studentId, date, durationMinutes, price, Texts.optional(topic, "lesson.topic-invalid"),
                status, now, null, null);
    }

    public static Lesson restore(UUID id, UUID studentId, LocalDate date, int durationMinutes, Money price,
            @Nullable String topic, LessonStatus status, Instant createdAt, @Nullable Instant cancelledAt,
            @Nullable String cancelReason) {
        return new Lesson(id, studentId, date, durationMinutes, price, topic, status, createdAt, cancelledAt,
                cancelReason);
    }

    public void cancel(@Nullable String reason, Instant now) {
        if (status == LessonStatus.CANCELLED) {
            throw new BusinessRuleException("lesson.already-cancelled", "The lesson is already cancelled");
        }
        status = LessonStatus.CANCELLED;
        cancelledAt = now;
        cancelReason = Texts.optional(reason, "lesson.reason-invalid");
    }

    /** Amount charged to the student: the price, or zero for a cancelled lesson. */
    public Money charge() {
        return status.isCharged() ? price : Money.zero(price.currency());
    }

    public UUID id() {
        return id;
    }

    public UUID studentId() {
        return studentId;
    }

    public LocalDate date() {
        return date;
    }

    public int durationMinutes() {
        return durationMinutes;
    }

    public Money price() {
        return price;
    }

    public @Nullable String topic() {
        return topic;
    }

    public LessonStatus status() {
        return status;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public @Nullable Instant cancelledAt() {
        return cancelledAt;
    }

    public @Nullable String cancelReason() {
        return cancelReason;
    }
}
