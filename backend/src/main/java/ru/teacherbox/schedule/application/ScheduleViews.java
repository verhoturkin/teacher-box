package ru.teacherbox.schedule.application;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.ChangeRequest;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.Participant;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.schedule.domain.Series;

/** Read models of the schedule API. */
public final class ScheduleViews {

    private ScheduleViews() {
    }

    /** A participant of a lesson with their attendance. */
    public record ParticipantView(UUID studentId, @Nullable String studentName, Attendance attendance) {

        static ParticipantView of(Participant participant, ScheduleNames names) {
            return new ParticipantView(participant.studentId(), names.student(participant.studentId()),
                    participant.attendance());
        }
    }

    /**
     * A lesson with one student ({@code studentId}) or with a group ({@code groupId}).
     *
     * @param participants     students of the lesson with their attendance
     * @param meetingUrl       the lesson's own link to the online lesson
     * @param joinUrl          where the lesson takes place: its own link or the room of the student or group
     * @param originalStartsAt the time the lesson was first planned for, if it moved
     * @param pendingRequests  unanswered requests of the participants about this lesson
     */
    public record LessonView(
            UUID id,
            @Nullable UUID studentId,
            @Nullable String studentName,
            @Nullable UUID groupId,
            @Nullable String groupName,
            List<ParticipantView> participants,
            @Nullable UUID seriesId,
            Instant startsAt,
            Instant endsAt,
            int durationMinutes,
            @Nullable String topic,
            @Nullable String meetingUrl,
            @Nullable String joinUrl,
            LessonStatus status,
            @Nullable CancelledBy cancelledBy,
            @Nullable String cancelReason,
            @Nullable Instant originalStartsAt,
            List<RequestView> pendingRequests) {

        static LessonView of(Lesson lesson, ScheduleNames names, List<RequestView> pendingRequests) {
            UUID studentId = lesson.isGroup() ? null : lesson.studentId();
            return new LessonView(lesson.id(), studentId, studentId == null ? null : names.student(studentId),
                    lesson.groupId(), names.group(lesson.groupId()),
                    lesson.participants().stream().map(participant -> ParticipantView.of(participant, names)).toList(),
                    lesson.seriesId(), lesson.startsAt(), lesson.endsAt(), lesson.durationMinutes(), lesson.topic(),
                    lesson.meetingUrl(), names.joinUrl(lesson), lesson.status(), lesson.cancelledBy(),
                    lesson.cancelReason(),
                    lesson.originalStartsAt(), List.copyOf(pendingRequests));
        }

        /** What a participant sees: their own attendance and requests, not those of classmates. */
        LessonView forStudent(UUID participantId) {
            return new LessonView(id, studentId, studentName, groupId, groupName,
                    participants.stream().filter(participant -> participant.studentId().equals(participantId)).toList(),
                    seriesId, startsAt, endsAt, durationMinutes, topic, meetingUrl, joinUrl, status, cancelledBy,
                    cancelReason, originalStartsAt,
                    pendingRequests.stream().filter(request -> request.studentId().equals(participantId)).toList());
        }
    }

    /**
     * @param groupId  the group of a group lesson
     * @param late     a cancellation asked for later than the cancellation policy allows
     * @param answer   the teacher's comment on the decision
     */
    public record RequestView(
            UUID id,
            UUID lessonId,
            UUID studentId,
            @Nullable String studentName,
            @Nullable UUID groupId,
            @Nullable String groupName,
            ChangeKind kind,
            Instant lessonStartsAt,
            @Nullable Instant proposedStartsAt,
            @Nullable String comment,
            RequestStatus status,
            boolean late,
            @Nullable String answer,
            Instant createdAt,
            @Nullable Instant resolvedAt) {

        static RequestView of(ChangeRequest request, Lesson lesson, ScheduleNames names, Duration lateCancellation) {
            return new RequestView(request.id(), request.lessonId(), request.studentId(),
                    names.student(request.studentId()), lesson.groupId(), names.group(lesson.groupId()),
                    request.kind(), lesson.startsAt(), request.proposedStartsAt(), request.comment(), request.status(),
                    isLate(request.kind(), lesson.startsAt(), request.createdAt(), lateCancellation),
                    request.resolutionComment(), request.createdAt(), request.resolvedAt());
        }
    }

    /** A series with one student ({@code studentId}) or with a group ({@code groupId}). */
    public record SeriesView(
            UUID id,
            @Nullable UUID studentId,
            @Nullable String studentName,
            @Nullable UUID groupId,
            @Nullable String groupName,
            List<DayOfWeek> weekdays,
            LocalTime startTime,
            int durationMinutes,
            int intervalWeeks,
            LocalDate startsOn,
            @Nullable LocalDate endsOn,
            @Nullable String topic,
            @Nullable String meetingUrl) {

        static SeriesView of(Series series, ScheduleNames names) {
            UUID studentId = series.studentId();
            return new SeriesView(series.id(), studentId, studentId == null ? null : names.student(studentId),
                    series.groupId(), names.group(series.groupId()), series.weekdays(), series.startTime(),
                    series.durationMinutes(), series.intervalWeeks(), series.startsOn(), series.endsOn(),
                    series.topic(), series.meetingUrl());
        }
    }

    /** @param lessons number of lessons created ahead */
    public record SeriesPlanned(SeriesView series, int lessons) {
    }

    /**
     * Settings the UI needs to show and edit times correctly.
     *
     * @param timeZone time zone of series and notifications (the teacher's), e.g. {@code Europe/Moscow}
     */
    public record ScheduleSettings(String timeZone, int defaultDurationMinutes, long lateCancellationMinutes,
            List<Long> reminderMinutes) {
    }

    /**
     * @param path link path, returned only right after the link is created (it is not stored)
     */
    public record FeedView(boolean enabled, @Nullable Instant createdAt, @Nullable String path) {
    }

    static boolean isLate(ChangeKind kind, Instant lessonStartsAt, Instant requestedAt, Duration lateCancellation) {
        return kind == ChangeKind.CANCEL
                && Duration.between(requestedAt, lessonStartsAt).compareTo(lateCancellation) < 0;
    }

    /**
     * The teacher's schedule at a glance.
     *
     * @param today           lessons of today in the instance time zone (cancelled ones included)
     * @param next            the nearest scheduled lesson that has not ended, within the 7 days
     * @param weekLessons     scheduled lessons that have not ended, from now to the end of the 7th day
     * @param unmarked        lessons that ended without an outcome
     * @param pendingRequests unanswered requests of students
     * @param hasLessons      at least one lesson was ever planned
     */
    public record ScheduleSummary(List<LessonView> today, @Nullable LessonView next, int weekLessons, int unmarked,
            int pendingRequests, boolean hasLessons) {
    }

    /**
     * A student's schedule at a glance.
     *
     * @param next            the nearest scheduled lesson that has not ended
     * @param weekLessons     scheduled lessons that have not ended, from now to the end of the 7th day
     * @param pendingRequests the student's unanswered requests
     */
    public record MyScheduleSummary(@Nullable LessonView next, int weekLessons, int pendingRequests) {
    }
}
