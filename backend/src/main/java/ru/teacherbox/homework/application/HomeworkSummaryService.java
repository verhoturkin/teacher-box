package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.application.HomeworkViews.HomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyHomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.ReviewQueueItem;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.homework.persistence.TaskRepository.OpenDeadline;
import ru.teacherbox.homework.persistence.TaskRepository.WeekTask;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Homework counters for the home pages. */
@Service
@Transactional(readOnly = true)
public class HomeworkSummaryService {

    /** «Due soon» window. */
    static final Duration DUE_SOON = Duration.ofDays(3);
    private static final int OLDEST_TO_REVIEW = 3;
    private static final int UPCOMING = 5;
    private static final int WEEK_DAYS = 7;

    private final ReviewService reviews;
    private final StudentHomeworkService studentHomework;
    private final TaskRepository tasks;
    private final UserDirectory directory;
    private final ZoneId zone;
    private final Clock clock;

    public HomeworkSummaryService(ReviewService reviews, StudentHomeworkService studentHomework, TaskRepository tasks,
            UserDirectory directory, InstanceTimeZone timeZone, Clock clock) {
        this.reviews = reviews;
        this.studentHomework = studentHomework;
        this.tasks = tasks;
        this.directory = directory;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    public HomeworkSummary teacherSummary() {
        Instant now = clock.instant();
        List<ReviewQueueItem> queue = reviews.queue();
        Set<UUID> current = directory.currentStudents().stream().map(StudentSummary::id).collect(Collectors.toSet());
        List<Instant> deadlines = tasks.findOpenDeadlines().stream()
                .filter(deadline -> current.contains(deadline.studentId()))
                .map(OpenDeadline::dueAt)
                .toList();
        long overdue = deadlines.stream().filter(now::isAfter).count();
        long dueSoon = deadlines.stream().filter(due -> !now.isAfter(due) && !due.isAfter(now.plus(DUE_SOON))).count();
        LocalDate monday = LocalDate.ofInstant(now, zone).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant from = monday.atStartOfDay(zone).toInstant();
        Instant to = monday.plusDays(WEEK_DAYS).atStartOfDay(zone).toInstant();
        List<WeekTask> week = tasks.findActiveBetween(from, to).stream()
                .filter(task -> current.contains(task.studentId()))
                .toList();
        int weekAssigned = Math.toIntExact(week.stream()
                .filter(task -> inWeek(task.assignedAt(), from, to))
                .map(WeekTask::assignmentId)
                .distinct()
                .count());
        int weekOnTime = Math.toIntExact(week.stream()
                .filter(task -> task.submittedAt() != null && inWeek(task.submittedAt(), from, to))
                .filter(task -> task.dueAt() == null || !task.submittedAt().isAfter(task.dueAt()))
                .count());
        return new HomeworkSummary(queue.size(), Math.toIntExact(overdue), Math.toIntExact(dueSoon),
                queue.stream().limit(OLDEST_TO_REVIEW).toList(), weekAssigned, weekOnTime);
    }

    private static boolean inWeek(Instant moment, Instant from, Instant to) {
        return !moment.isBefore(from) && moment.isBefore(to);
    }

    public MyHomeworkSummary studentSummary(UUID studentId) {
        List<MyTask> open = studentHomework.tasks(studentId).stream().filter(task -> task.status().isOpen()).toList();
        return new MyHomeworkSummary(open.size(), Math.toIntExact(open.stream().filter(MyTask::overdue).count()),
                open.stream()
                        .sorted(Comparator.comparing(MyTask::dueAt, Comparator.nullsLast(Comparator.naturalOrder())))
                        .limit(UPCOMING)
                        .toList());
    }
}
