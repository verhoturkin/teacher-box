package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
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
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;

/** Homework counters for the home pages. */
@Service
@Transactional(readOnly = true)
public class HomeworkSummaryService {

    /** «Due soon» window. */
    static final Duration DUE_SOON = Duration.ofDays(3);
    private static final int OLDEST_TO_REVIEW = 3;
    private static final int UPCOMING = 5;

    private final ReviewService reviews;
    private final StudentHomeworkService studentHomework;
    private final TaskRepository tasks;
    private final UserDirectory directory;
    private final Clock clock;

    public HomeworkSummaryService(ReviewService reviews, StudentHomeworkService studentHomework, TaskRepository tasks,
            UserDirectory directory, Clock clock) {
        this.reviews = reviews;
        this.studentHomework = studentHomework;
        this.tasks = tasks;
        this.directory = directory;
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
        return new HomeworkSummary(queue.size(), Math.toIntExact(overdue), Math.toIntExact(dueSoon),
                queue.stream().limit(OLDEST_TO_REVIEW).toList());
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
