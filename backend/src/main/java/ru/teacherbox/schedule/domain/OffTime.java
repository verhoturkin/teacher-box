package ru.teacherbox.schedule.domain;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Time the teacher does not work (a lunch, a day off, a holiday). It is either {@link Once} — from one
 * moment to another, possibly for several days — or {@link Weekly} — on the given weekdays from a local
 * time to a local time of the instance time zone. Students see it as busy time and cannot ask to move
 * a lesson into it; the teacher's own lessons are not checked against it.
 */
public final class OffTime {

    /** Longest one-time period. */
    public static final Duration MAX_ONCE = Duration.ofDays(366);

    public enum Kind {
        ONCE,
        WEEKLY
    }

    /** When the teacher does not work. */
    public sealed interface Period permits Once, Weekly {

        Kind kind();

        /** Periods of off time that overlap {@code [from, to)}, in order. */
        List<Occurrence> between(Instant from, Instant to, ZoneId zone);
    }

    /** Once: from {@code startsAt} to {@code endsAt}. */
    public record Once(Instant startsAt, Instant endsAt) implements Period {

        public Once {
            if (!endsAt.isAfter(startsAt)) {
                throw new BusinessRuleException("schedule.off-time-invalid", "The off time ends before it starts");
            }
            if (Duration.between(startsAt, endsAt).compareTo(MAX_ONCE) > 0) {
                throw new BusinessRuleException("schedule.off-time-invalid", "The off time is longer than a year");
            }
        }

        @Override
        public Kind kind() {
            return Kind.ONCE;
        }

        @Override
        public List<Occurrence> between(Instant from, Instant to, ZoneId zone) {
            return startsAt.isBefore(to) && endsAt.isAfter(from) ? List.of(new Occurrence(startsAt, endsAt))
                    : List.of();
        }
    }

    /**
     * Every week on {@code weekdays} from {@code startTime} to {@code endTime} (local times of the
     * instance time zone), on days from {@code startsOn} to {@code endsOn}. An end that is not after
     * the start is on the next day: 22:00–07:00 is a night, 00:00–00:00 the whole day.
     */
    public record Weekly(Set<DayOfWeek> weekdays, LocalTime startTime, LocalTime endTime, LocalDate startsOn,
            @Nullable LocalDate endsOn) implements Period {

        public Weekly {
            if (weekdays.isEmpty()) {
                throw new BusinessRuleException("schedule.weekdays-empty", "Choose at least one day of the week");
            }
            if (endsOn != null && endsOn.isBefore(startsOn)) {
                throw new BusinessRuleException("schedule.off-time-invalid", "The off time ends before it starts");
            }
            weekdays = Collections.unmodifiableSet(EnumSet.copyOf(weekdays));
            startTime = startTime.truncatedTo(ChronoUnit.MINUTES);
            endTime = endTime.truncatedTo(ChronoUnit.MINUTES);
        }

        @Override
        public Kind kind() {
            return Kind.WEEKLY;
        }

        @Override
        public List<Occurrence> between(Instant from, Instant to, ZoneId zone) {
            // A period of the day before may last into the first day.
            LocalDate first = LocalDate.ofInstant(from, zone).minusDays(1);
            LocalDate last = LocalDate.ofInstant(to, zone);
            if (first.isBefore(startsOn)) {
                first = startsOn;
            }
            if (endsOn != null && endsOn.isBefore(last)) {
                last = endsOn;
            }
            List<Occurrence> occurrences = new ArrayList<>();
            for (LocalDate date = first; !date.isAfter(last); date = date.plusDays(1)) {
                if (!weekdays.contains(date.getDayOfWeek())) {
                    continue;
                }
                Instant start = ZonedDateTime.of(date, startTime, zone).toInstant();
                LocalDate endDate = endTime.isAfter(startTime) ? date : date.plusDays(1);
                Instant end = ZonedDateTime.of(endDate, endTime, zone).toInstant();
                if (end.isAfter(start) && start.isBefore(to) && end.isAfter(from)) {
                    occurrences.add(new Occurrence(start, end));
                }
            }
            return occurrences;
        }

        /** Weekdays from Monday to Sunday. */
        public List<DayOfWeek> orderedWeekdays() {
            return List.copyOf(weekdays);
        }
    }

    /** One period when the teacher does not work. */
    public record Occurrence(Instant start, Instant end) {
    }

    private final UUID id;
    private Period period;
    private @Nullable String note;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private OffTime(UUID id, Period period, @Nullable String note, Instant createdAt, Instant updatedAt,
            long version) {
        this.id = Objects.requireNonNull(id);
        this.period = Objects.requireNonNull(period);
        this.note = note;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    /** @param note what the time is, for the teacher (e.g. «Обед»); students never see it */
    public static OffTime create(UUID id, Period period, @Nullable String note, Instant now) {
        return new OffTime(id, period, Texts.optional(note), now, now, 0);
    }

    public static OffTime restore(UUID id, Period period, @Nullable String note, Instant createdAt,
            Instant updatedAt, long version) {
        return new OffTime(id, period, note, createdAt, updatedAt, version);
    }

    public void change(Period newPeriod, @Nullable String newNote, Instant now) {
        period = Objects.requireNonNull(newPeriod);
        note = Texts.optional(newNote);
        updatedAt = now;
    }

    /** Periods of off time that overlap {@code [from, to)}, in order. */
    public List<Occurrence> between(Instant from, Instant to, ZoneId zone) {
        return period.between(from, to, zone);
    }

    public UUID id() {
        return id;
    }

    public Period period() {
        return period;
    }

    public @Nullable String note() {
        return note;
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
