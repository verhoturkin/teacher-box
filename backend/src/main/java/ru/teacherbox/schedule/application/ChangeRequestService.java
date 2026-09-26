package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.domain.ChangeRequest;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.persistence.ChangeRequestRepository;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * Students ask to move or cancel their lessons; the teacher approves or declines. A student never
 * changes the schedule directly.
 */
@Service
public class ChangeRequestService {

    /**
     * @param startsAt new time of an approved move; defaults to the time the student proposed
     * @param charge   charge an approved cancellation as a missed lesson
     */
    public record Approval(@Nullable Instant startsAt, boolean charge, @Nullable String answer) {
    }

    private final ChangeRequestRepository requests;
    private final LessonRepository lessons;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final ZoneId zone;
    private final Clock clock;

    public ChangeRequestService(ChangeRequestRepository requests, LessonRepository lessons, UserDirectory directory,
            ApplicationEventPublisher events, ScheduleProperties properties, InstanceTimeZone timeZone, Clock clock) {
        this.requests = requests;
        this.lessons = lessons;
        this.directory = directory;
        this.events = events;
        this.properties = properties;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    /** A student's request about one of their own lessons. */
    @Transactional
    public RequestView request(UUID studentId, UUID lessonId, ChangeKind kind, @Nullable Instant proposedStartsAt,
            @Nullable String comment) {
        Lesson lesson = lessons.findById(lessonId)
                .filter(found -> found.studentId().equals(studentId))
                .orElseThrow(ChangeRequestService::lessonNotFound);
        if (requests.findPendingForLesson(lessonId).isPresent()) {
            throw new ConflictException("schedule.request-pending", "The lesson already has an unanswered request");
        }
        Instant now = clock.instant();
        ChangeRequest request = ChangeRequest.open(Ids.newId(), lesson, kind, proposedStartsAt, comment, now);
        requests.insert(request);
        boolean late = ScheduleViews.isLate(kind, lesson.startsAt(), now, properties.lateCancellation());
        events.publishEvent(new LessonChangeRequested(request.id(), lesson.id(), studentId, kind, lesson.startsAt(),
                request.proposedStartsAt(), request.comment(), late, now));
        return RequestView.of(request, lesson.startsAt(), name(studentId), properties.lateCancellation());
    }

    /** The student takes back an unanswered request. */
    @Transactional
    public void withdraw(UUID studentId, UUID requestId) {
        ChangeRequest request = requests.findById(requestId)
                .filter(found -> found.studentId().equals(studentId))
                .orElseThrow(ChangeRequestService::requestNotFound);
        request.withdraw(clock.instant());
        requests.update(request);
    }

    @Transactional
    public LessonView approve(UUID requestId, Approval approval) {
        ChangeRequest request = findRequest(requestId);
        Lesson lesson = lessons.findById(request.lessonId()).orElseThrow(ChangeRequestService::lessonNotFound);
        Instant now = clock.instant();
        boolean charged = false;
        if (request.kind() == ChangeKind.RESCHEDULE) {
            if (approval.charge()) {
                throw new BusinessRuleException("schedule.charge-invalid", "Only a cancellation can be charged");
            }
            Instant previous = lesson.startsAt();
            Instant startsAt = approval.startsAt() != null ? approval.startsAt() : request.proposedStartsAt();
            lesson.edit(requireTime(startsAt), lesson.durationMinutes(), lesson.topic(), lesson.meetingUrl(), now);
            lessons.update(lesson);
            lessons.clearReminders(lesson.id());
            events.publishEvent(new LessonRescheduled(lesson.id(), lesson.studentId(), previous, lesson.startsAt(),
                    lesson.durationMinutes(), true, now));
        } else if (approval.charge()) {
            UUID completionId = Ids.newId();
            lesson.chargeCancellation(CancelledBy.STUDENT, request.comment(), completionId, now);
            lessons.update(lesson);
            charged = true;
            events.publishEvent(new ScheduledLessonCancelled(lesson.id(), lesson.studentId(), lesson.startsAt(),
                    CancelledBy.STUDENT, lesson.cancelReason(), true, true, now));
            events.publishEvent(new LessonCompleted(completionId, lesson.id(), lesson.studentId(),
                    LocalDate.ofInstant(lesson.startsAt(), zone), lesson.durationMinutes(), lesson.topic(), true,
                    now));
        } else {
            lesson.cancel(CancelledBy.STUDENT, request.comment(), now);
            lessons.update(lesson);
            events.publishEvent(new ScheduledLessonCancelled(lesson.id(), lesson.studentId(), lesson.startsAt(),
                    CancelledBy.STUDENT, lesson.cancelReason(), false, true, now));
        }
        request.approve(approval.answer(), now);
        requests.update(request);
        events.publishEvent(new LessonChangeResolved(request.id(), lesson.id(), lesson.studentId(), request.kind(),
                true, lesson.startsAt(), charged, request.resolutionComment(), now));
        return LessonView.of(lesson, name(lesson.studentId()), null);
    }

    @Transactional
    public RequestView decline(UUID requestId, @Nullable String answer) {
        ChangeRequest request = findRequest(requestId);
        Lesson lesson = lessons.findById(request.lessonId()).orElseThrow(ChangeRequestService::lessonNotFound);
        Instant now = clock.instant();
        request.decline(answer, now);
        requests.update(request);
        events.publishEvent(new LessonChangeResolved(request.id(), lesson.id(), lesson.studentId(), request.kind(),
                false, lesson.startsAt(), false, request.resolutionComment(), now));
        return RequestView.of(request, lesson.startsAt(), name(lesson.studentId()), properties.lateCancellation());
    }

    private ChangeRequest findRequest(UUID requestId) {
        return requests.findById(requestId).orElseThrow(ChangeRequestService::requestNotFound);
    }

    private static Instant requireTime(@Nullable Instant startsAt) {
        if (startsAt == null) {
            throw new BusinessRuleException("schedule.proposed-time-invalid", "The new time is missing");
        }
        return startsAt;
    }

    private @Nullable String name(UUID studentId) {
        return directory.findStudent(studentId).map(StudentSummary::displayName).orElse(null);
    }

    private static NotFoundException lessonNotFound() {
        return new NotFoundException("schedule.lesson-not-found", "Lesson not found");
    }

    private static NotFoundException requestNotFound() {
        return new NotFoundException("schedule.request-not-found", "Request not found");
    }
}
