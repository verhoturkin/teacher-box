package ru.teacherbox.notifications.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * An outbox entry: a notification to be sent to one messenger account. Failed attempts are retried
 * with exponential backoff (30 s, 1 min, 2 min, ... up to 1 h) until {@code maxAttempts} is reached.
 */
public final class Delivery {

    static final Duration FIRST_RETRY = Duration.ofSeconds(30);
    static final Duration MAX_RETRY = Duration.ofHours(1);
    private static final int MAX_ERROR = 1000;

    private final UUID id;
    private final UUID notificationId;
    private final UUID recipientId;
    private final ChannelType channel;
    private final String externalId;
    private final String text;
    private DeliveryStatus status;
    private int attempts;
    private Instant nextAttemptAt;
    private @Nullable String lastError;
    private final Instant createdAt;
    private @Nullable Instant sentAt;

    private Delivery(UUID id, UUID notificationId, UUID recipientId, ChannelType channel, String externalId,
            String text, DeliveryStatus status, int attempts, Instant nextAttemptAt, @Nullable String lastError,
            Instant createdAt, @Nullable Instant sentAt) {
        this.id = id;
        this.notificationId = notificationId;
        this.recipientId = recipientId;
        this.channel = channel;
        this.externalId = externalId;
        this.text = text;
        this.status = status;
        this.attempts = attempts;
        this.nextAttemptAt = nextAttemptAt;
        this.lastError = lastError;
        this.createdAt = createdAt;
        this.sentAt = sentAt;
    }

    public static Delivery schedule(UUID id, UUID notificationId, UUID recipientId, ChannelType channel,
            String externalId, String text, Instant now) {
        return schedule(id, notificationId, recipientId, channel, externalId, text, now, now);
    }

    /** @param notBefore the first attempt is made at this time (e.g. after the recipient's quiet hours) */
    public static Delivery schedule(UUID id, UUID notificationId, UUID recipientId, ChannelType channel,
            String externalId, String text, Instant now, Instant notBefore) {
        return new Delivery(id, notificationId, recipientId, channel, externalId, text, DeliveryStatus.PENDING, 0,
                notBefore.isAfter(now) ? notBefore : now, null, now, null);
    }

    public static Delivery restore(UUID id, UUID notificationId, UUID recipientId, ChannelType channel,
            String externalId, String text, DeliveryStatus status, int attempts, Instant nextAttemptAt,
            @Nullable String lastError, Instant createdAt, @Nullable Instant sentAt) {
        return new Delivery(id, notificationId, recipientId, channel, externalId, text, status, attempts,
                nextAttemptAt, lastError, createdAt, sentAt);
    }

    public void markSent(Instant now) {
        attempts++;
        status = DeliveryStatus.SENT;
        sentAt = now;
        lastError = null;
    }

    /** Records a failed attempt: schedules a retry or gives up after {@code maxAttempts}. */
    public void markFailed(String error, int maxAttempts, Instant now) {
        attempts++;
        lastError = error.length() > MAX_ERROR ? error.substring(0, MAX_ERROR) : error;
        if (attempts >= maxAttempts) {
            status = DeliveryStatus.FAILED;
            return;
        }
        nextAttemptAt = now.plus(backoff(attempts));
    }

    /** Tries a given up delivery once more from the start (the administrator's decision). */
    public void retry(Instant now) {
        if (status != DeliveryStatus.FAILED) {
            throw new IllegalStateException("Only failed deliveries can be retried");
        }
        status = DeliveryStatus.PENDING;
        attempts = 0;
        nextAttemptAt = now;
    }

    /** Gives up immediately (e.g. the channel is no longer configured). */
    public void abandon(String reason) {
        status = DeliveryStatus.FAILED;
        lastError = reason;
    }

    static Duration backoff(int attempts) {
        Duration delay = FIRST_RETRY.multipliedBy(1L << Math.min(attempts - 1, 20));
        return delay.compareTo(MAX_RETRY) > 0 ? MAX_RETRY : delay;
    }

    public UUID id() {
        return id;
    }

    public UUID notificationId() {
        return notificationId;
    }

    public UUID recipientId() {
        return recipientId;
    }

    public ChannelType channel() {
        return channel;
    }

    public String externalId() {
        return externalId;
    }

    public String text() {
        return text;
    }

    public DeliveryStatus status() {
        return status;
    }

    public int attempts() {
        return attempts;
    }

    public Instant nextAttemptAt() {
        return nextAttemptAt;
    }

    public @Nullable String lastError() {
        return lastError;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public @Nullable Instant sentAt() {
        return sentAt;
    }
}
