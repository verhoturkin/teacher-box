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
import ru.teacherbox.schedule.domain.ChangeRequest;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.schedule.domain.Series;

/** Read models of the schedule API. */
public final class ScheduleViews {

    private ScheduleViews() {
    }

    /**
     * @param originalStartsAt the time the lesson was first planned for, if it moved
     * @param pendingRequest   the student's unanswered request about this lesson
     */
    public record LessonView(
            UUID id,
            UUID studentId,
            @Nullable String studentName,
            @Nullable UUID seriesId,
            Instant startsAt,
            Instant endsAt,
            int durationMinutes,
            @Nullable String topic,
            @Nullable String meetingUrl,
            LessonStatus status,
            @Nullable CancelledBy cancelledBy,
            @Nullable String cancelReason,
            @Nullable Instant originalStartsAt,
            @Nullable RequestView pendingRequest) {

        static LessonView of(Lesson lesson, @Nullable String studentName, @Nullable RequestView pendingRequest) {
            return new LessonView(lesson.id(), lesson.studentId(), studentName, lesson.seriesId(), lesson.startsAt(),
                    lesson.endsAt(), lesson.durationMinutes(), lesson.topic(), lesson.meetingUrl(), lesson.status(),
                    lesson.cancelledBy(), lesson.cancelReason(), lesson.originalStartsAt(), pendingRequest);
        }
    }

    /**
     * @param late   a cancellation asked for later than the cancellation policy allows
     * @param answer the teacher's comment on the decision
     */
    public record RequestView(
            UUID id,
            UUID lessonId,
            UUID studentId,
            @Nullable String studentName,
            ChangeKind kind,
            Instant lessonStartsAt,
            @Nullable Instant proposedStartsAt,
            @Nullable String comment,
            RequestStatus status,
            boolean late,
            @Nullable String answer,
            Instant createdAt,
            @Nullable Instant resolvedAt) {

        static RequestView of(ChangeRequest request, Instant lessonStartsAt, @Nullable String studentName,
                Duration lateCancellation) {
            return new RequestView(request.id(), request.lessonId(), request.studentId(), studentName, request.kind(),
                    lessonStartsAt, request.proposedStartsAt(), request.comment(), request.status(),
                    isLate(request.kind(), lessonStartsAt, request.createdAt(), lateCancellation),
                    request.resolutionComment(), request.createdAt(), request.resolvedAt());
        }
    }

    public record SeriesView(
            UUID id,
            UUID studentId,
            @Nullable String studentName,
            List<DayOfWeek> weekdays,
            LocalTime startTime,
            int durationMinutes,
            int intervalWeeks,
            LocalDate startsOn,
            @Nullable LocalDate endsOn,
            @Nullable String topic,
            @Nullable String meetingUrl) {

        static SeriesView of(Series series, @Nullable String studentName) {
            return new SeriesView(series.id(), series.studentId(), studentName, series.weekdays(),
                    series.startTime(), series.durationMinutes(), series.intervalWeeks(), series.startsOn(),
                    series.endsOn(), series.topic(), series.meetingUrl());
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
}
