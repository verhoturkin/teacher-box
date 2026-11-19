package ru.teacherbox.schedule.web;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.application.FeedService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleViews.FeedView;
import ru.teacherbox.schedule.application.ScheduleViews.HistoryEntry;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.MyScheduleSummary;
import ru.teacherbox.schedule.application.ScheduleViews.ScheduleSettings;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;

/**
 * The family cabinet (ADR-0069): a guardian reads a child's schedule as the child sees it, through the same
 * queries as {@code /api/me/schedule} after {@link GuardianAccess#require}; no teacher's busy times and no
 * requests here. The guardian's own calendar link holds the lessons of all their children.
 */
@RestController
@RequestMapping("/api/guardian")
class GuardianScheduleController {

    private final GuardianAccess access;
    private final ScheduleQueries queries;
    private final FeedService feeds;

    GuardianScheduleController(GuardianAccess access, ScheduleQueries queries, FeedService feeds) {
        this.access = access;
        this.queries = queries;
        this.feeds = feeds;
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
