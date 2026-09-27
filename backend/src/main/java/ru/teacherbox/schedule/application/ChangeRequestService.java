package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
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

/**
 * Students ask to move or cancel their lessons; the teacher approves or declines. A student never
 * changes the schedule directly. In a group lesson a cancellation is the student's own absence: a
 * timely one is accepted at once, a late one waits for the teacher (ADR-0011).
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
    private final ScheduleDirectory directory;
    private final ScheduleQueries queries;
    private final LessonEvents lessonEvents;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final Clock clock;

    public ChangeRequestService(ChangeRequestRepository requests, LessonRepository lessons,
            ScheduleDirectory directory, ScheduleQueries queries, LessonEvents lessonEvents,
            ApplicationEventPublisher events, ScheduleProperties properties, Clock clock) {
        this.requests = requests;
        this.lessons = lessons;
        this.directory = directory;
        this.queries = queries;
        this.lessonEvents = lessonEvents;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    /** A student's request about one of their own lessons. */
    @Transactional
    public RequestView request(UUID studentId, UUID lessonId, ChangeKind kind, @Nullable Instant proposedStartsAt,
            @Nullable String comment) {
        Lesson lesson = lessons.findById(lessonId)
                .filter(found -> found.hasParticipant(studentId))
                .orElseThrow(ChangeRequestService::lessonNotFound);
        if (lesson.isGroup() && !lesson.expectedIds().contains(studentId)) {
            throw new BusinessRuleException("schedule.participant-not-expected",
                    "The student has already said they would not come");
        }
        if (requests.findPendingForLesson(lessonId, studentId).isPresent()) {
            throw new ConflictException("schedule.request-pending", "The lesson already has an unanswered request");
        }
        Instant now = clock.instant();
        ChangeRequest request = ChangeRequest.open(Ids.newId(), lesson, studentId, kind, proposedStartsAt, comment,
                now);
        boolean late = ScheduleViews.isLate(kind, lesson.startsAt(), now, properties.lateCancellation());
        boolean accepted = lesson.isGroup() && kind == ChangeKind.CANCEL && !late;
        if (accepted) {
            lesson.excuse(studentId, null, now);
            lessons.update(lesson);
            request.approve(null, now);
        }
        requests.insert(request);
        events.publishEvent(new LessonChangeRequested(request.id(), lesson.id(), studentId, lesson.groupId(), kind,
                lesson.startsAt(), request.proposedStartsAt(), request.comment(), late, accepted, now));
        return view(request, lesson);
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
            outdateOthers(request, now);
            lessonEvents.rescheduled(lesson, previous, request.studentId(), now);
        } else if (lesson.isGroup()) {
            UUID completionId = approval.charge() ? Ids.newId() : null;
            lesson.excuse(request.studentId(), completionId, now);
            lessons.update(lesson);
            if (completionId != null) {
                charged = true;
                lessonEvents.completed(lesson, request.studentId(), completionId, true, now);
            }
        } else if (approval.charge()) {
            UUID completionId = Ids.newId();
            lesson.chargeCancellation(CancelledBy.STUDENT, request.comment(), completionId, now);
            lessons.update(lesson);
            charged = true;
            lessonEvents.cancelled(lesson, CancelledBy.STUDENT, true, true, now);
            lessonEvents.completed(lesson, request.studentId(), completionId, true, now);
        } else {
            lesson.cancel(CancelledBy.STUDENT, request.comment(), now);
            lessons.update(lesson);
            lessonEvents.cancelled(lesson, CancelledBy.STUDENT, false, true, now);
        }
        request.approve(approval.answer(), now);
        requests.update(request);
        events.publishEvent(new LessonChangeResolved(request.id(), lesson.id(), request.studentId(), lesson.groupId(),
                request.kind(), true, lesson.startsAt(), charged, request.resolutionComment(), now));
        return queries.lesson(lesson.id());
    }

    @Transactional
    public RequestView decline(UUID requestId, @Nullable String answer) {
        ChangeRequest request = findRequest(requestId);
        Lesson lesson = lessons.findById(request.lessonId()).orElseThrow(ChangeRequestService::lessonNotFound);
        Instant now = clock.instant();
        request.decline(answer, now);
        requests.update(request);
        events.publishEvent(new LessonChangeResolved(request.id(), lesson.id(), request.studentId(), lesson.groupId(),
                request.kind(), false, lesson.startsAt(), false, request.resolutionComment(), now));
        return view(request, lesson);
    }

    /** After a group lesson moved, the other participants' requests about the old time are outdated. */
    private void outdateOthers(ChangeRequest approved, Instant now) {
        requests.findPendingForLesson(approved.lessonId()).stream()
                .filter(other -> !other.id().equals(approved.id()))
                .forEach(other -> {
                    other.outdate(now);
                    requests.update(other);
                });
    }

    private RequestView view(ChangeRequest request, Lesson lesson) {
        ScheduleNames names = directory.names(List.of(request.studentId()),
                lesson.groupId() == null ? List.of() : List.of(lesson.groupId()));
        return RequestView.of(request, lesson, names, properties.lateCancellation());
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

    private static NotFoundException lessonNotFound() {
        return new NotFoundException("schedule.lesson-not-found", "Lesson not found");
    }

    private static NotFoundException requestNotFound() {
        return new NotFoundException("schedule.request-not-found", "Request not found");
    }
}
