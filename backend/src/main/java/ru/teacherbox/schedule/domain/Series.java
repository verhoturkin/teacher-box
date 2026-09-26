package ru.teacherbox.schedule.domain;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Regular lessons: on the given weekdays at a local time of the instance time zone, every
 * {@code intervalWeeks} weeks. A daylight saving change does not move the lessons. Lessons are
 * created ahead up to {@link #generatedUntil()}; a series is never edited in place — it ends and a
 * new one continues from the date of the change.
 */
public final class Series {

    public static final int MAX_INTERVAL_WEEKS = 4;

    private final UUID id;
    private final UUID studentId;
    private final Set<DayOfWeek> weekdays;
    private final LocalTime startTime;
    private final int durationMinutes;
    private final int intervalWeeks;
    private final LocalDate startsOn;
    private @Nullable LocalDate endsOn;
    private final @Nullable String topic;
    private final @Nullable String meetingUrl;
    private LocalDate generatedUntil;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private Series(UUID id, UUID studentId, Set<DayOfWeek> weekdays, LocalTime startTime, int durationMinutes,
            int intervalWeeks, LocalDate startsOn, @Nullable LocalDate endsOn, @Nullable String topic,
            @Nullable String meetingUrl, LocalDate generatedUntil, Instant createdAt, Instant updatedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.studentId = Objects.requireNonNull(studentId);
        this.weekdays = EnumSet.copyOf(weekdays);
        this.startTime = Objects.requireNonNull(startTime);
        this.durationMinutes = durationMinutes;
        this.intervalWeeks = intervalWeeks;
        this.startsOn = Objects.requireNonNull(startsOn);
        this.endsOn = endsOn;
        this.topic = topic;
        this.meetingUrl = meetingUrl;
        this.generatedUntil = Objects.requireNonNull(generatedUntil);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    public static Series create(UUID id, UUID studentId, Collection<DayOfWeek> weekdays, LocalTime startTime,
            int durationMinutes, int intervalWeeks, LocalDate startsOn, @Nullable LocalDate endsOn,
            @Nullable String topic, @Nullable String meetingUrl, Instant now) {
        if (weekdays.isEmpty()) {
            throw new BusinessRuleException("schedule.weekdays-empty", "Choose at least one day of the week");
        }
        if (intervalWeeks < 1 || intervalWeeks > MAX_INTERVAL_WEEKS) {
            throw new BusinessRuleException("schedule.interval-invalid",
                    "Lessons repeat every 1-" + MAX_INTERVAL_WEEKS + " weeks");
        }
        if (endsOn != null && endsOn.isBefore(startsOn)) {
            throw new BusinessRuleException("schedule.series-dates-invalid", "The series ends before it starts");
        }
        return new Series(id, studentId, EnumSet.copyOf(weekdays), startTime.withSecond(0).withNano(0),
                Texts.duration(durationMinutes), intervalWeeks, startsOn, endsOn, Texts.optional(topic),
                Texts.meetingUrl(meetingUrl), startsOn.minusDays(1), now, now, 0);
    }

    public static Series restore(UUID id, UUID studentId, Set<DayOfWeek> weekdays, LocalTime startTime,
            int durationMinutes, int intervalWeeks, LocalDate startsOn, @Nullable LocalDate endsOn,
            @Nullable String topic, @Nullable String meetingUrl, LocalDate generatedUntil, Instant createdAt,
            Instant updatedAt, long version) {
        return new Series(id, studentId, weekdays, startTime, durationMinutes, intervalWeeks, startsOn, endsOn, topic,
                meetingUrl, generatedUntil, createdAt, updatedAt, version);
    }

    /** Days with a lesson in {@code [from, to]}, in order. */
    public List<LocalDate> datesBetween(LocalDate from, LocalDate to) {
        LocalDate first = from.isBefore(startsOn) ? startsOn : from;
        LocalDate last = endsOn != null && endsOn.isBefore(to) ? endsOn : to;
        LocalDate firstWeek = weekStart(startsOn);
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate date = first; !date.isAfter(last); date = date.plusDays(1)) {
            if (weekdays.contains(date.getDayOfWeek())
                    && ChronoUnit.WEEKS.between(firstWeek, weekStart(date)) % intervalWeeks == 0) {
                dates.add(date);
            }
        }
        return dates;
    }

    /** Start of the lesson on {@code date}: the local time in {@code zone} (moved forward in a DST gap). */
    public Instant startOn(LocalDate date, ZoneId zone) {
        return ZonedDateTime.of(date, startTime, zone).toInstant();
    }

    /**
     * Ends the series before {@code from}; nothing changes if it already ends earlier.
     *
     * @return {@code true} if the end date moved
     */
    public boolean endBefore(LocalDate from, Instant now) {
        LocalDate last = from.minusDays(1);
        if (endsOn != null && !endsOn.isAfter(last)) {
            return false;
        }
        endsOn = last;
        updatedAt = now;
        return true;
    }

    /** Remembers that the lessons up to {@code date} are created. */
    public void generatedThrough(LocalDate date, Instant now) {
        if (date.isAfter(generatedUntil)) {
            generatedUntil = date;
            updatedAt = now;
        }
    }

    /** Whether lessons after {@code date} may still exist or be created. */
    public boolean continuesAfter(LocalDate date) {
        return endsOn == null || endsOn.isAfter(date);
    }

    private static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public UUID id() {
        return id;
    }

    public UUID studentId() {
        return studentId;
    }

    /** Weekdays from Monday to Sunday. */
    public List<DayOfWeek> weekdays() {
        return List.copyOf(weekdays);
    }

    public LocalTime startTime() {
        return startTime;
    }

    public int durationMinutes() {
        return durationMinutes;
    }

    public int intervalWeeks() {
        return intervalWeeks;
    }

    public LocalDate startsOn() {
        return startsOn;
    }

    public @Nullable LocalDate endsOn() {
        return endsOn;
    }

    public @Nullable String topic() {
        return topic;
    }

    public @Nullable String meetingUrl() {
        return meetingUrl;
    }

    public LocalDate generatedUntil() {
        return generatedUntil;
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

    /** Called by the repository after an update. */
    public void markSaved(long savedVersion) {
        version = savedVersion;
    }
}
