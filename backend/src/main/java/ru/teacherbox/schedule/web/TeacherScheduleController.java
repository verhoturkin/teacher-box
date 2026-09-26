package ru.teacherbox.schedule.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.application.ScheduleViews.SeriesPlanned;
import ru.teacherbox.schedule.application.ScheduleViews.SeriesView;
import ru.teacherbox.schedule.domain.LessonStatus;

/** The teacher's schedule: lessons, regular series, outcomes and students' requests. */
@RestController
@RequestMapping("/api/teacher/schedule")
class TeacherScheduleController {

    record LessonRequest(
            @NotNull UUID studentId,
            @NotNull Instant startsAt,
            @Min(1) @Max(600) @Nullable Integer durationMinutes,
            @Size(max = 500) @Nullable String topic,
            @Size(max = 1000) @Nullable String meetingUrl,
            @Nullable Boolean allowOverlap) {
    }

    record EditRequest(
            @NotNull Instant startsAt,
            @NotNull @Min(1) @Max(600) Integer durationMinutes,
            @Size(max = 500) @Nullable String topic,
            @Size(max = 1000) @Nullable String meetingUrl,
            @Nullable Boolean allowOverlap) {
    }

    record CancelRequest(@Size(max = 500) @Nullable String reason, @Nullable Boolean byStudent,
            @Nullable Boolean charge) {
    }

    record OutcomeRequest(@NotNull LessonStatus outcome) {
    }

    /** @param startsOn first day; for a change — the day the new settings apply from */
    record SeriesRequest(
            @NotNull UUID studentId,
            @NotEmpty Set<DayOfWeek> weekdays,
            @NotNull LocalTime startTime,
            @Min(1) @Max(600) @Nullable Integer durationMinutes,
            @Min(1) @Max(4) @Nullable Integer intervalWeeks,
            @NotNull LocalDate startsOn,
            @Nullable LocalDate endsOn,
            @Size(max = 500) @Nullable String topic,
            @Size(max = 1000) @Nullable String meetingUrl,
            @Nullable Boolean allowOverlap) {

        ScheduleService.PlanSeries command() {
            return new ScheduleService.PlanSeries(studentId, weekdays, startTime, durationMinutes,
                    intervalWeeks == null ? 1 : intervalWeeks, startsOn, endsOn, topic, meetingUrl, yes(allowOverlap));
        }
    }

    record StopRequest(@NotNull LocalDate from) {
    }

    record ApproveRequest(@Nullable Instant startsAt, @Nullable Boolean charge,
            @Size(max = 500) @Nullable String answer) {
    }

    record DeclineRequest(@Size(max = 500) @Nullable String answer) {
    }

    private final ScheduleService schedule;
    private final ChangeRequestService requests;
    private final ScheduleQueries queries;

    TeacherScheduleController(ScheduleService schedule, ChangeRequestService requests, ScheduleQueries queries) {
        this.schedule = schedule;
        this.requests = requests;
        this.queries = queries;
    }

    /** Lessons that start on days {@code [from, to)}. */
    @GetMapping("/lessons")
    List<LessonView> lessons(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return queries.lessons(from, to);
    }

    @GetMapping("/lessons/{lessonId}")
    LessonView lesson(@PathVariable UUID lessonId) {
        return queries.lesson(lessonId);
    }

    @PostMapping("/lessons")
    @ResponseStatus(HttpStatus.CREATED)
    LessonView plan(@Valid @RequestBody LessonRequest request) {
        return schedule.plan(new ScheduleService.PlanLesson(request.studentId(), request.startsAt(),
                request.durationMinutes(), request.topic(), request.meetingUrl(), yes(request.allowOverlap())));
    }

    @PutMapping("/lessons/{lessonId}")
    LessonView edit(@PathVariable UUID lessonId, @Valid @RequestBody EditRequest request) {
        return schedule.edit(lessonId, new ScheduleService.EditLesson(request.startsAt(), request.durationMinutes(),
                request.topic(), request.meetingUrl(), yes(request.allowOverlap())));
    }

    @PostMapping("/lessons/{lessonId}/cancel")
    LessonView cancel(@PathVariable UUID lessonId, @Valid @RequestBody CancelRequest request) {
        return schedule.cancel(lessonId,
                new ScheduleService.CancelLesson(request.reason(), yes(request.byStudent()), yes(request.charge())));
    }

    @PutMapping("/lessons/{lessonId}/outcome")
    LessonView outcome(@PathVariable UUID lessonId, @Valid @RequestBody OutcomeRequest request) {
        return schedule.setOutcome(lessonId, request.outcome());
    }

    @DeleteMapping("/lessons/{lessonId}/outcome")
    LessonView reopen(@PathVariable UUID lessonId) {
        return schedule.reopen(lessonId);
    }

    /** Lessons that have ended without a marked outcome. */
    @GetMapping("/unmarked")
    List<LessonView> unmarked() {
        return queries.unmarked();
    }

    @GetMapping("/series")
    List<SeriesView> series() {
        return queries.activeSeries();
    }

    @PostMapping("/series")
    @ResponseStatus(HttpStatus.CREATED)
    SeriesPlanned planSeries(@Valid @RequestBody SeriesRequest request) {
        return schedule.planSeries(request.command());
    }

    @PutMapping("/series/{seriesId}")
    SeriesPlanned changeSeries(@PathVariable UUID seriesId, @Valid @RequestBody SeriesRequest request) {
        return schedule.changeSeries(seriesId, request.command());
    }

    @PostMapping("/series/{seriesId}/stop")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void stopSeries(@PathVariable UUID seriesId, @Valid @RequestBody StopRequest request) {
        schedule.stopSeries(seriesId, request.from());
    }

    /** Unanswered requests of the students. */
    @GetMapping("/requests")
    List<RequestView> pendingRequests() {
        return queries.pendingRequests();
    }

    @PostMapping("/requests/{requestId}/approve")
    LessonView approve(@PathVariable UUID requestId, @Valid @RequestBody ApproveRequest request) {
        return requests.approve(requestId,
                new ChangeRequestService.Approval(request.startsAt(), yes(request.charge()), request.answer()));
    }

    @PostMapping("/requests/{requestId}/decline")
    RequestView decline(@PathVariable UUID requestId, @Valid @RequestBody DeclineRequest request) {
        return requests.decline(requestId, request.answer());
    }

    /** Optional flags of the requests are off unless sent as {@code true}. */
    private static boolean yes(@Nullable Boolean flag) {
        return Boolean.TRUE.equals(flag);
    }
}
