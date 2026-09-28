package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.application.ScheduleViews.OffTimePeriod;
import ru.teacherbox.schedule.application.ScheduleViews.OffTimeView;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;
import ru.teacherbox.schedule.domain.OffTime;
import ru.teacherbox.schedule.persistence.OffTimeRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Time the teacher does not work, once or weekly: students see it as busy time. */
@Service
public class OffTimeService {

    private final OffTimeRepository offTimes;
    private final ZoneId zone;
    private final Clock clock;

    public OffTimeService(OffTimeRepository offTimes, InstanceTimeZone timeZone, Clock clock) {
        this.offTimes = offTimes;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    /** Off time that is not over: weekly first, then once by its start. */
    @Transactional(readOnly = true)
    public List<OffTimeView> current() {
        Instant now = clock.instant();
        return offTimes.findCurrent(now, LocalDate.ofInstant(now, zone)).stream().map(OffTimeView::of).toList();
    }

    @Transactional
    public OffTimeView create(OffTime.Period period, @Nullable String note) {
        OffTime offTime = OffTime.create(Ids.newId(), period, note, clock.instant());
        offTimes.insert(offTime);
        return OffTimeView.of(offTime);
    }

    @Transactional
    public OffTimeView change(UUID offTimeId, OffTime.Period period, @Nullable String note) {
        OffTime offTime = offTimes.findById(offTimeId).orElseThrow(() -> notFound(offTimeId));
        offTime.change(period, note, clock.instant());
        offTimes.update(offTime);
        return OffTimeView.of(offTime);
    }

    @Transactional
    public void delete(UUID offTimeId) {
        if (!offTimes.delete(offTimeId)) {
            throw notFound(offTimeId);
        }
    }

    /** Periods of off time in {@code [from, to)} for the teacher's calendar, in order. */
    @Transactional(readOnly = true)
    public List<OffTimePeriod> periods(Instant from, Instant to) {
        if (!to.isAfter(from) || Duration.between(from, to).compareTo(TeacherAvailability.MAX_RANGE) > 0) {
            throw new BusinessRuleException("schedule.range-invalid", "The period must be up to 62 days long");
        }
        return overlapping(from, to).stream()
                .flatMap(offTime -> offTime.between(from, to, zone).stream()
                        .map(occurrence -> new OffTimePeriod(offTime.id(), occurrence.start(), occurrence.end(),
                                offTime.note())))
                .sorted(Comparator.comparing(OffTimePeriod::start))
                .toList();
    }

    /** When the teacher does not work in {@code [from, to)}: the periods only. */
    List<BusyTime> busy(Instant from, Instant to) {
        return overlapping(from, to).stream()
                .flatMap(offTime -> offTime.between(from, to, zone).stream())
                .map(occurrence -> new BusyTime(occurrence.start(), occurrence.end()))
                .toList();
    }

    private List<OffTime> overlapping(Instant from, Instant to) {
        return offTimes.findOverlapping(from, to, LocalDate.ofInstant(from, zone).minusDays(1),
                LocalDate.ofInstant(to, zone));
    }

    private static NotFoundException notFound(UUID offTimeId) {
        return new NotFoundException("schedule.off-time-not-found", "Off time not found");
    }
}
