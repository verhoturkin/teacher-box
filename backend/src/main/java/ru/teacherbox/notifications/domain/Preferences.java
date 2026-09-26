package ru.teacherbox.notifications.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.EnumSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * What a recipient gets in messengers: muted topics are not sent (the personal area still shows
 * them), and during quiet hours messages wait until the quiet time ends. Quiet hours may cross
 * midnight (22:00–08:00); times are local times of the instance time zone.
 */
public record Preferences(Set<NotificationTopic> mutedTopics, @Nullable LocalTime quietFrom,
        @Nullable LocalTime quietTo) {

    public static final Preferences DEFAULT = new Preferences(Set.of(), null, null);

    public Preferences {
        if ((quietFrom == null) != (quietTo == null)) {
            throw new BusinessRuleException("notification.quiet-hours-invalid", "Set both ends of the quiet hours");
        }
        if (quietFrom != null && quietFrom.equals(quietTo)) {
            throw new BusinessRuleException("notification.quiet-hours-invalid", "Quiet hours cannot be empty");
        }
        EnumSet<NotificationTopic> muted = EnumSet.noneOf(NotificationTopic.class);
        muted.addAll(mutedTopics);
        muted.removeIf(topic -> !topic.isMutable());
        mutedTopics = Set.copyOf(muted);
    }

    public boolean sendsToMessengers(NotificationKind kind) {
        return !mutedTopics.contains(NotificationTopic.of(kind));
    }

    /** When a message created at {@code now} may be sent: now, or the end of the quiet hours. */
    public Instant deliverAt(Instant now, ZoneId zone) {
        if (quietFrom == null || quietTo == null) {
            return now;
        }
        ZonedDateTime local = now.atZone(zone);
        LocalTime time = local.toLocalTime();
        LocalDate day = local.toLocalDate();
        boolean overnight = quietFrom.isAfter(quietTo);
        boolean quiet = overnight
                ? !time.isBefore(quietFrom) || time.isBefore(quietTo)
                : !time.isBefore(quietFrom) && time.isBefore(quietTo);
        if (!quiet) {
            return now;
        }
        LocalDate endDay = overnight && !time.isBefore(quietFrom) ? day.plusDays(1) : day;
        return ZonedDateTime.of(endDay, quietTo, zone).toInstant();
    }
}
