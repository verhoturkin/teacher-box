package ru.teacherbox.schedule.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.FeedService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleViews.FeedView;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.MyScheduleSummary;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.application.ScheduleViews.ScheduleSettings;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The personal area: a student's own lessons and requests. The settings and the calendar link are
 * available to the teacher as well (the teacher's link contains all lessons).
 */
@RestController
@RequestMapping("/api/me/schedule")
class MyScheduleController {

    record ChangeRequestBody(
            @NotNull ChangeKind kind,
            @Nullable Instant proposedStartsAt,
            @Size(max = 500) @Nullable String comment) {
    }

    private final ScheduleQueries queries;
    private final ChangeRequestService requests;
    private final FeedService feeds;

    MyScheduleController(ScheduleQueries queries, ChangeRequestService requests, FeedService feeds) {
        this.queries = queries;
        this.requests = requests;
        this.feeds = feeds;
    }

    @GetMapping("/settings")
    ScheduleSettings settings() {
        return queries.settings();
    }

    @GetMapping("/summary")
    MyScheduleSummary summary(CurrentUser user) {
        return queries.studentSummary(studentId(user));
    }

    @GetMapping("/lessons")
    List<LessonView> lessons(CurrentUser user, @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return queries.studentLessons(studentId(user), from, to);
    }

    @GetMapping("/lessons/{lessonId}")
    LessonView lesson(CurrentUser user, @PathVariable UUID lessonId) {
        return queries.studentLesson(studentId(user), lessonId);
    }

    @PostMapping("/lessons/{lessonId}/requests")
    @ResponseStatus(HttpStatus.CREATED)
    RequestView request(CurrentUser user, @PathVariable UUID lessonId, @Valid @RequestBody ChangeRequestBody body) {
        return requests.request(studentId(user), lessonId, body.kind(), body.proposedStartsAt(), body.comment());
    }

    @GetMapping("/requests")
    List<RequestView> myRequests(CurrentUser user) {
        return queries.studentRequests(studentId(user));
    }

    @DeleteMapping("/requests/{requestId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void withdraw(CurrentUser user, @PathVariable UUID requestId) {
        requests.withdraw(studentId(user), requestId);
    }

    @GetMapping("/feed")
    FeedView feed(CurrentUser user) {
        return feeds.status(user.id());
    }

    /** Creates a new calendar link; it is returned only in this response. */
    @PostMapping("/feed")
    FeedView createFeed(CurrentUser user) {
        return feeds.create(user.id());
    }

    @DeleteMapping("/feed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void disableFeed(CurrentUser user) {
        feeds.disable(user.id());
    }

    private static UUID studentId(CurrentUser user) {
        if (user.isTeacher()) {
            throw new ForbiddenException("schedule.students-only", "Available to students only");
        }
        return user.id();
    }
}
