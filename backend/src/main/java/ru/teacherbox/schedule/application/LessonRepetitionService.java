package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.LessonRepeatScheduled;
import ru.teacherbox.schedule.api.LessonRepeatStopped;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.RepeatRule;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.schedule.persistence.RepeatRuleRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Lesson-owned recurrence; only generation metadata is kept outside the lesson. */
@Service
@Transactional
public class LessonRepetitionService {
    public enum Scope { ONLY, FOLLOWING }

    public record Options(@Nullable Integer repeatWeeks, @Nullable LocalDate repeatUntil, Scope scope,
            @Nullable Long version, @Nullable Long repeatVersion) {
    }

    public record FollowingView(@Nullable Long repeatVersion, List<UUID> affected, List<UUID> protectedLessons) {
    }

    private final ScheduleService schedule;
    private final ScheduleQueries queries;
    private final ScheduleDirectory directory;
    private final LessonRepository lessons;
    private final RepeatRuleRepository rules;
    private final ScheduleProperties properties;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final ZoneId zone;

    public LessonRepetitionService(ScheduleService schedule, ScheduleQueries queries, LessonRepository lessons,
            RepeatRuleRepository rules, ScheduleProperties properties, ApplicationEventPublisher events,
            Clock clock, InstanceTimeZone timeZone, ScheduleDirectory directory) {
        this.schedule = schedule;
        this.directory = directory;
        this.queries = queries;
        this.lessons = lessons;
        this.rules = rules;
        this.properties = properties;
        this.events = events;
        this.clock = clock;
        this.zone = timeZone.zoneId();
    }

    public LessonView plan(ScheduleService.PlanLesson command, Options options) {
        int weeks = options.repeatWeeks() == null ? 0 : options.repeatWeeks();
        LessonView created = schedule.plan(command, weeks == 0);
        if (weeks == 0) return created;
        begin(find(created.id()), weeks, options.repeatUntil(), List.of(), List.of(), command.allowOverlap());
        return queries.lesson(created.id());
    }

    public LessonView edit(UUID id, ScheduleService.EditLesson command, Options options) {
        Lesson selected = find(id);
        check(selected.version(), options.version());
        RepeatRule current = rule(selected);
        if (current != null) check(current.version(), options.repeatVersion());
        int weeks = options.repeatWeeks() == null ? (current == null ? 0 : current.intervalWeeks()) : options.repeatWeeks();
        LocalDate until = options.repeatWeeks() == null && current != null ? current.endsOn() : options.repeatUntil();
        boolean changed = current != null && (weeks != current.intervalWeeks() || !Objects.equals(until, current.endsOn()));
        if (changed && options.scope() != Scope.FOLLOWING) {
            throw new BusinessRuleException("schedule.repeat-scope-required", "Changing repetition requires this and following scope");
        }
        List<Lesson> protectedLessons = List.of();
        List<LocalDate> suppressed = List.of();
        if (current != null && options.scope() == Scope.FOLLOWING) {
            suppressed = rules.suppressedFrom(current.id(), occurrence(selected));
            List<Lesson> tail = tail(selected);
            protectedLessons = tail.stream().filter(item -> !item.id().equals(id) && protectedLesson(item)).toList();
            end(current, selected, weeks > 0);
            tail.stream().filter(item -> !item.id().equals(id) && !protectedLesson(item)).forEach(lessons::delete);
        }
        schedule.edit(id, command);
        selected = find(id);
        if (current == null || options.scope() == Scope.FOLLOWING) {
            if (weeks > 0) begin(selected, weeks, until, protectedLessons, suppressed, command.allowOverlap());
            else {
                selected.repeatWith(null, occurrence(selected));
                lessons.update(selected);
            }
        }
        return queries.lesson(id);
    }

    @Transactional(readOnly = true)
    public FollowingView preview(UUID id) {
        Lesson selected = find(id);
        RepeatRule rule = rule(selected);
        List<Lesson> tail = tail(selected);
        return new FollowingView(rule == null ? null : rule.version(),
                tail.stream().filter(item -> item.id().equals(id) || !protectedLesson(item)).map(Lesson::id).toList(),
                tail.stream().filter(item -> !item.id().equals(id) && protectedLesson(item)).map(Lesson::id).toList());
    }

    public LessonView cancel(UUID id, ScheduleService.CancelLesson command, Scope scope,
            @Nullable Long version, @Nullable Long repeatVersion) {
        Lesson selected = find(id);
        check(selected.version(), version);
        RepeatRule rule = rule(selected);
        if (rule != null && scope == Scope.FOLLOWING) {
            check(rule.version(), repeatVersion);
            end(rule, selected, false);
            for (Lesson future : tail(selected)) {
                if (future.id().equals(id) || protectedLesson(future)) continue;
                future.cancel(CancelledBy.TEACHER, command.reason(), clock.instant());
                lessons.update(future);
                schedule.outdatePendingRequests(future.id(), clock.instant());
            }
        }
        return schedule.cancel(id, command);
    }

    public void delete(UUID id, Scope scope, @Nullable Long version, @Nullable Long repeatVersion) {
        Lesson selected = find(id);
        check(selected.version(), version);
        selected.requireDeletable();
        RepeatRule rule = rule(selected);
        if (rule != null && scope == Scope.FOLLOWING) {
            check(rule.version(), repeatVersion);
            end(rule, selected, false);
            tail(selected).stream().filter(item -> !item.id().equals(id) && !protectedLesson(item)).forEach(lessons::delete);
        }
        schedule.delete(id);
    }

    private void begin(Lesson selected, int weeks, @Nullable LocalDate until, List<Lesson> protectedLessons, List<LocalDate> suppressed, boolean allowOverlap) {
        UUID groupId = selected.groupId();
        if (groupId == null) directory.currentStudent(selected.studentId());
        else if (directory.currentGroup(groupId).memberIds().isEmpty()) {
            throw new BusinessRuleException("schedule.group-empty", "A repeating group lesson needs current members");
        }
        LocalDate date = LocalDate.ofInstant(selected.startsAt(), zone);
        RepeatRule created = RepeatRule.create(Ids.newId(), selected.isGroup() ? null : selected.studentId(),
                selected.groupId(), Set.of(date.getDayOfWeek()), LocalTime.ofInstant(selected.startsAt(), zone),
                selected.durationMinutes(), weeks, date, until, selected.topic(), selected.meetingUrl(), clock.instant())
                .continueFrom(occurrence(selected));
        rules.insert(created);
        selected.repeatWith(created.id(), occurrence(selected));
        lessons.update(selected);
        for (LocalDate dateToSkip : suppressed) lessons.suppress(created.id(), dateToSkip);
        for (Lesson preserved : protectedLessons) lessons.suppress(created.id(), occurrence(preserved));
        LocalDate today = LocalDate.ofInstant(clock.instant(), zone);
        LocalDate from = date.isBefore(today) ? today : date;
        LocalDate horizon = today.plusDays(properties.horizonDays());
        for (LocalDate occurrence : created.datesBetween(from, horizon)) {
            if (lessons.existsForSeriesDate(created.id(), occurrence)) continue;
            var starts = created.startOn(occurrence, zone);
            schedule.requireFree(starts, starts.plusSeconds(60L * created.durationMinutes()), selected.id(), allowOverlap);
        }
        schedule.generate(created, from, horizon, clock.instant());
        rules.update(created);
        events.publishEvent(new LessonRepeatScheduled(selected.id(), selected.groupId(), selected.studentIds(), created.weekdays(),
                created.startTime(), created.durationMinutes(), weeks, date, until, clock.instant()));
    }

    private void end(RepeatRule rule, Lesson selected, boolean replaced) {
        LocalDate boundary = occurrence(selected);
        if (rule.endBefore(rule.actualDate(boundary), clock.instant())) rules.update(rule);
        events.publishEvent(new LessonRepeatStopped(selected.id(), selected.groupId(), selected.studentIds(), boundary, replaced, clock.instant()));
    }

    private List<Lesson> tail(Lesson selected) {
        UUID ruleId = selected.seriesId();
        return ruleId == null ? List.of(selected) : lessons.repeatTail(ruleId, occurrence(selected));
    }

    private static boolean protectedLesson(Lesson lesson) {
        return lesson.status() != LessonStatus.SCHEDULED || lesson.individuallyChanged()
                || lesson.participants().stream().anyMatch(participant -> participant.completionId() != null);
    }

    private LocalDate occurrence(Lesson lesson) {
        return lesson.seriesDate() == null ? LocalDate.ofInstant(lesson.startsAt(), zone) : lesson.seriesDate();
    }

    private @Nullable RepeatRule rule(Lesson lesson) {
        UUID id = lesson.seriesId();
        if (id == null) return null;
        RepeatRule rule = rules.findById(id).orElseThrow(() -> new NotFoundException("schedule.repeat-not-found", "Repeat rule not found"));
        return rule.endsOn() != null && rule.actualDate(occurrence(lesson)).isAfter(rule.endsOn()) ? null : rule;
    }

    private Lesson find(UUID id) {
        return lessons.findById(id).orElseThrow(() -> new NotFoundException("schedule.lesson-not-found", "Lesson not found"));
    }

    private static void check(long actual, @Nullable Long expected) {
        if (expected != null && actual != expected) throw new OptimisticLockingFailureException("The lesson or its repetition was modified");
    }
}
