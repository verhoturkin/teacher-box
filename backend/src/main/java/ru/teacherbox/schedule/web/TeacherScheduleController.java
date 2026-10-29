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
import java.util.Map;
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
import ru.teacherbox.schedule.application.LessonRepetitionService;
import ru.teacherbox.schedule.application.LessonRepetitionService.Options;
import ru.teacherbox.schedule.application.LessonRepetitionService.Scope;
import ru.teacherbox.schedule.application.ScheduleViews.HistoryEntry;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.application.ScheduleViews.ScheduleSummary;
import ru.teacherbox.schedule.application.ScheduleViews.UpcomingLessons;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;

/** The teacher's schedule: lessons, regular series, outcomes and students' requests. */
@RestController
@RequestMapping("/api/teacher/schedule")
class TeacherScheduleController {

    /** A lesson with a student or with a group: exactly one of {@code studentId} and {@code groupId}. */
    record LessonRequest(
            @Nullable UUID studentId,
            @Nullable UUID groupId,
            @NotNull Instant startsAt,
            @Min(1) @Max(600) @Nullable Integer durationMinutes,
            @Size(max = 500) @Nullable String title,
            @Size(max = 500) @Nullable String topic,
            @Size(max = 1000) @Nullable String meetingUrl,
            @Nullable Boolean allowOverlap,
            @Min(0) @Max(4) @Nullable Integer repeatWeeks,
            @Nullable LocalDate repeatUntil,
            @Nullable Scope scope,
            @Nullable Long version,
            @Nullable Long repeatVersion) {
    }

    record EditRequest(
            @NotNull Instant startsAt,
            @NotNull @Min(1) @Max(600) Integer durationMinutes,
            @Size(max = 500) @Nullable String title,
            @Size(max = 500) @Nullable String topic,
            @Size(max = 1000) @Nullable String meetingUrl,
            @Nullable Boolean allowOverlap,
            @Min(0) @Max(4) @Nullable Integer repeatWeeks,
            @Nullable LocalDate repeatUntil,
            @Nullable Scope scope,
            @Nullable Long version,
            @Nullable Long repeatVersion) {
    }

    record SummaryRequest(@Size(max = Lesson.MAX_SUMMARY) @Nullable String summary,
            @Size(max = Lesson.MAX_NEXT_PLAN) @Nullable String nextPlan) {
    }

    record NoteRequest(@Size(max = Lesson.MAX_SUMMARY) @Nullable String note) {
    }

    record CancelRequest(@Size(max = 500) @Nullable String reason, @Nullable Boolean byStudent,
            @Nullable Boolean charge, @Nullable Scope scope, @Nullable Long version, @Nullable Long repeatVersion) {
    }

    record RestoreRequest(@Nullable Boolean allowOverlap) {
    }

    record OutcomeRequest(@NotNull LessonStatus outcome) {
    }

    /** Attendance of every participant: ATTENDED, MISSED or EXCUSED. */
    record AttendanceRequest(@NotEmpty Map<@NotNull UUID, @NotNull Attendance> marks) {
    }

    record ApproveRequest(@Nullable Instant startsAt, @Nullable Boolean charge,
            @Size(max = 500) @Nullable String answer, @Nullable Boolean allowBusy) {
    }

    record DeclineRequest(@Size(max = 500) @Nullable String answer) {
    }

    private final ScheduleService schedule;
    private final LessonRepetitionService repetition;
    private final ChangeRequestService requests;
    private final ScheduleQueries queries;

    TeacherScheduleController(ScheduleService schedule, ChangeRequestService requests, ScheduleQueries queries, LessonRepetitionService repetition) {
        this.schedule = schedule;
        this.repetition = repetition;
        this.requests = requests;
        this.queries = queries;
    }

    /**
     * Lessons that start on days {@code [from, to)}: all, or of one student (group lessons included) or of one
     * group.
     */
    @GetMapping("/lessons")
    List<LessonView> lessons(@RequestParam LocalDate from, @RequestParam LocalDate to,
            @RequestParam(required = false) @Nullable UUID studentId,
            @RequestParam(required = false) @Nullable UUID groupId) {
        return queries.lessons(from, to, studentId, groupId);
    }

    @GetMapping("/lessons/{lessonId}")
    LessonView lesson(@PathVariable UUID lessonId) {
        return queries.lesson(lessonId);
    }

    @PostMapping("/lessons")
    @ResponseStatus(HttpStatus.CREATED)
    LessonView plan(@Valid @RequestBody LessonRequest request) {
        return repetition.plan(new ScheduleService.PlanLesson(request.studentId(), request.groupId(), request.startsAt(),
                request.durationMinutes(), request.title(), request.topic(), request.meetingUrl(), yes(request.allowOverlap())),
                new Options(request.repeatWeeks(), request.repeatUntil(), scope(request.scope()), request.version(), request.repeatVersion()));
    }

    @PutMapping("/lessons/{lessonId}")
    LessonView edit(@PathVariable UUID lessonId, @Valid @RequestBody EditRequest request) {
        return repetition.edit(lessonId, new ScheduleService.EditLesson(request.startsAt(), request.durationMinutes(),
                request.title(), request.topic(), request.meetingUrl(), yes(request.allowOverlap())),
                new Options(request.repeatWeeks(), request.repeatUntil(), scope(request.scope()), request.version(), request.repeatVersion()));
    }

    @PostMapping("/lessons/{lessonId}/cancel")
    LessonView cancel(@PathVariable UUID lessonId, @Valid @RequestBody CancelRequest request) {
        return repetition.cancel(lessonId,
                new ScheduleService.CancelLesson(request.reason(), yes(request.byStudent()), yes(request.charge())),
                scope(request.scope()), request.version(), request.repeatVersion());
    }

    @DeleteMapping("/lessons/{lessonId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID lessonId, @RequestParam(defaultValue = "ONLY") Scope scope,
            @RequestParam(required = false) @Nullable Long version,
            @RequestParam(required = false) @Nullable Long repeatVersion) {
        repetition.delete(lessonId, scope, version, repeatVersion);
    }

    @PutMapping("/lessons/{lessonId}/summary")
    LessonView summary(@PathVariable UUID lessonId, @Valid @RequestBody SummaryRequest request) {
        return schedule.updateSummary(lessonId, request.summary(), request.nextPlan());
    }

    @PostMapping("/lessons/{lessonId}/summary/share")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void shareSummary(@PathVariable UUID lessonId) {
        schedule.shareSummary(lessonId);
    }

    @PutMapping("/lessons/{lessonId}/notes/{studentId}")
    LessonView note(@PathVariable UUID lessonId, @PathVariable UUID studentId,
            @Valid @RequestBody NoteRequest request) {
        return schedule.updateNote(lessonId, studentId, request.note());
    }

    /** Held lessons of a student, newest first; the next page — {@code before} = start of the last one. */
    @GetMapping("/students/{studentId}/history")
    List<HistoryEntry> studentHistory(@PathVariable UUID studentId,
            @RequestParam(required = false) @Nullable Instant before,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return queries.studentHistory(studentId, before, limit);
    }

    @GetMapping("/groups/{groupId}/history")
    List<HistoryEntry> groupHistory(@PathVariable UUID groupId,
            @RequestParam(required = false) @Nullable Instant before,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return queries.groupHistory(groupId, before, limit);
    }

    /** Lessons ahead of a student: a series is one item, one-off lessons and exceptions are their own. */
    @GetMapping("/students/{studentId}/upcoming")
    UpcomingLessons studentUpcoming(@PathVariable UUID studentId) {
        return queries.studentUpcoming(studentId);
    }

    @GetMapping("/groups/{groupId}/upcoming")
    UpcomingLessons groupUpcoming(@PathVariable UUID groupId) {
        return queries.groupUpcoming(groupId);
    }

    @GetMapping("/lessons/{lessonId}/following")
    LessonRepetitionService.FollowingView following(@PathVariable UUID lessonId) {
        return repetition.preview(lessonId);
    }

    private static Scope scope(@Nullable Scope value) {
        return value == null ? Scope.ONLY : value;
    }

    @PostMapping("/lessons/{lessonId}/restore")
    LessonView restore(@PathVariable UUID lessonId, @RequestBody(required = false) @Nullable RestoreRequest request) {
        return schedule.reinstate(lessonId, request != null && yes(request.allowOverlap()));
    }

    @PutMapping("/lessons/{lessonId}/outcome")
    LessonView outcome(@PathVariable UUID lessonId, @Valid @RequestBody OutcomeRequest request) {
        return schedule.setOutcome(lessonId, request.outcome());
    }

    @PutMapping("/lessons/{lessonId}/attendance")
    LessonView attendance(@PathVariable UUID lessonId, @Valid @RequestBody AttendanceRequest request) {
        return schedule.markAttendance(lessonId, request.marks());
    }

    @DeleteMapping("/lessons/{lessonId}/outcome")
    LessonView reopen(@PathVariable UUID lessonId) {
        return schedule.reopen(lessonId);
    }

    /** Lessons that have ended without a marked outcome. */
    @GetMapping("/summary")
    ScheduleSummary summary() {
        return queries.summary();
    }

    @GetMapping("/unmarked")
    List<LessonView> unmarked() {
        return queries.unmarked();
    }

    /** Unanswered requests of the students. */
    @GetMapping("/requests")
    List<RequestView> pendingRequests() {
        return queries.pendingRequests();
    }

    @PostMapping("/requests/{requestId}/approve")
    LessonView approve(@PathVariable UUID requestId, @Valid @RequestBody ApproveRequest request) {
        return requests.approve(requestId,
                new ChangeRequestService.Approval(request.startsAt(), yes(request.charge()), request.answer(),
                        yes(request.allowBusy())));
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
