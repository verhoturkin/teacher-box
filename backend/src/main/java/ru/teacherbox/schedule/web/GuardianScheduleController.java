package ru.teacherbox.schedule.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.FeedService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.TeacherAvailability;
import ru.teacherbox.schedule.application.TeacherAvailability.BusyTime;
import ru.teacherbox.schedule.application.ScheduleViews.FeedView;
import ru.teacherbox.schedule.application.ScheduleViews.HistoryEntry;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.MyScheduleSummary;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.application.ScheduleViews.ScheduleSettings;
import ru.teacherbox.schedule.web.MyScheduleController.ChangeRequestBody;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;

/**
 * The family cabinet (ADR-0069): a guardian reads a child's schedule as the child sees it and asks to move or
 * cancel the child's lessons, through the same services as {@code /api/me/schedule} after
 * {@link GuardianAccess#require}; a request is the child's, sent by the guardian. The guardian's own calendar link
 * holds the lessons of all their children.
 */
@RestController
@RequestMapping("/api/guardian")
class GuardianScheduleController {

    private final GuardianAccess access;
    private final ScheduleQueries queries;
    private final FeedService feeds;

    private final ChangeRequestService requests;
    private final TeacherAvailability availability;

    GuardianScheduleController(GuardianAccess access, ScheduleQueries queries, FeedService feeds,
            ChangeRequestService requests, TeacherAvailability availability) {
        this.access = access;
        this.queries = queries;
        this.feeds = feeds;
        this.requests = requests;
        this.availability = availability;
    }

    @GetMapping("/students/{studentId}/schedule/settings")
    ScheduleSettings settings(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return queries.settings();
    }

    @GetMapping("/students/{studentId}/schedule/summary")
    MyScheduleSummary summary(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return queries.studentSummary(studentId);
    }

    @GetMapping("/students/{studentId}/schedule/lessons")
    List<LessonView> lessons(CurrentUser user, @PathVariable UUID studentId, @RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        access.require(user, studentId);
        return queries.studentLessons(studentId, from, to);
    }

    @GetMapping("/students/{studentId}/schedule/lessons/{lessonId}")
    LessonView lesson(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID lessonId) {
        access.require(user, studentId);
        return queries.studentLesson(studentId, lessonId);
    }

    /** The child's held lessons with the shared summaries, newest first. */
    @GetMapping("/students/{studentId}/schedule/history")
    List<HistoryEntry> history(CurrentUser user, @PathVariable UUID studentId,
            @RequestParam(required = false) @Nullable Instant before,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        access.require(user, studentId);
        return queries.myHistory(studentId, before, limit);
    }

    /** When the teacher is busy, to choose a new time for the child's lesson: periods only. */
    @GetMapping("/students/{studentId}/schedule/busy")
    List<BusyTime> busy(CurrentUser user, @PathVariable UUID studentId, @RequestParam Instant from,
            @RequestParam Instant to) {
        access.require(user, studentId);
        return availability.forStudent(studentId, from, to);
    }

    /** Free start times of a day to move the child's lesson to. */
    @GetMapping("/students/{studentId}/schedule/free-times")
    List<Instant> freeTimes(CurrentUser user, @PathVariable UUID studentId, @RequestParam LocalDate date,
            @RequestParam UUID lessonId) {
        access.require(user, studentId);
        return availability.freeTimes(studentId, lessonId, date);
    }

    /** Asks the teacher to move or cancel the child's lesson on the child's behalf. */
    @PostMapping("/students/{studentId}/schedule/lessons/{lessonId}/requests")
    @ResponseStatus(HttpStatus.CREATED)
    RequestView request(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID lessonId,
            @Valid @RequestBody ChangeRequestBody body) {
        access.require(user, studentId);
        return requests.request(studentId, user.id(), lessonId, body.kind(), body.proposedStartsAt(), body.comment());
    }

    /** The child's latest requests, whoever sent them, newest first. */
    @GetMapping("/students/{studentId}/schedule/requests")
    List<RequestView> childRequests(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return queries.studentRequests(studentId);
    }

    /** Takes back an unanswered request of the child, the guardian's or the child's own. */
    @DeleteMapping("/students/{studentId}/schedule/requests/{requestId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void withdraw(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID requestId) {
        access.require(user, studentId);
        requests.withdraw(studentId, requestId);
    }

    @GetMapping("/schedule/feed")
    FeedView feed(CurrentUser user) {
        return feeds.status(user.id());
    }

    /** Creates a new calendar link of all the children's lessons; it is returned only in this response. */
    @PostMapping("/schedule/feed")
    FeedView createFeed(CurrentUser user) {
        return feeds.create(user.id());
    }

    @DeleteMapping("/schedule/feed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void disableFeed(CurrentUser user) {
        feeds.disable(user.id());
    }
}
