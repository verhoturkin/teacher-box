package ru.teacherbox.schedule.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.Participant;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Publishes the events of a lesson with its group and participants (ADR-0011). */
@Component
class LessonEvents {

    private final ApplicationEventPublisher events;
    private final ZoneId zone;

    LessonEvents(ApplicationEventPublisher events, InstanceTimeZone timeZone) {
        this.events = events;
        this.zone = timeZone.zoneId();
    }

    void scheduled(Lesson lesson, Instant now) {
        events.publishEvent(new LessonScheduled(lesson.id(), lesson.groupId(), lesson.studentIds(), lesson.startsAt(),
                lesson.durationMinutes(), lesson.topic(), now));
    }

    void rescheduled(Lesson lesson, Instant previousStartsAt, @Nullable UUID requestedBy, Instant now) {
        events.publishEvent(new LessonRescheduled(lesson.id(), lesson.groupId(), lesson.studentIds(),
                previousStartsAt, lesson.startsAt(), lesson.durationMinutes(), requestedBy, now));
    }

    void cancelled(Lesson lesson, CancelledBy by, boolean charged, boolean byRequest, Instant now) {
        events.publishEvent(new ScheduledLessonCancelled(lesson.id(), lesson.groupId(), lesson.studentIds(),
                lesson.startsAt(), by, lesson.cancelReason(), charged, byRequest, now));
    }

    /** Revokes the previous charges of the changed participants and charges the new marks. */
    void charges(Lesson lesson, List<Participant.Change> changes, Instant now) {
        for (Participant.Change change : changes) {
            if (change.revokedCompletionId() != null) {
                events.publishEvent(new LessonCompletionRevoked(change.revokedCompletionId(), lesson.id(),
                        change.studentId(), now));
            }
        }
        for (Participant.Change change : changes) {
            if (change.newCompletionId() != null) {
                completed(lesson, change.studentId(), change.newCompletionId(), change.missed(), now);
            }
        }
    }

    /** Revokes the charges of the participants. */
    void revoked(Lesson lesson, List<Participant> charged, Instant now) {
        for (Participant participant : charged) {
            UUID completionId = participant.completionId();
            if (completionId != null) {
                events.publishEvent(new LessonCompletionRevoked(completionId, lesson.id(), participant.studentId(),
                        now));
            }
        }
    }

    void completed(Lesson lesson, UUID studentId, UUID completionId, boolean missed, Instant now) {
        events.publishEvent(new LessonCompleted(completionId, lesson.id(), studentId, lesson.groupId(),
                LocalDate.ofInstant(lesson.startsAt(), zone), lesson.durationMinutes(), lesson.topic(), missed, now));
    }
}
