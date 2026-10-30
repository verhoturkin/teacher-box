package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.application.HomeworkViews.HomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.Journal;
import ru.teacherbox.homework.application.HomeworkViews.JournalCell;
import ru.teacherbox.homework.application.HomeworkViews.JournalColumn;
import ru.teacherbox.homework.application.HomeworkViews.JournalRow;
import ru.teacherbox.homework.application.HomeworkViews.JournalStatus;
import ru.teacherbox.homework.application.HomeworkViews.MyHomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.ReviewQueueItem;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.TaskStatus;
import ru.teacherbox.homework.domain.quiz.QuizAttempt;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.homework.persistence.TaskRepository.OpenDeadline;
import ru.teacherbox.homework.persistence.TaskRepository.WeekTask;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
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
    private final AssignmentRepository assignments;
    private final QuizService quiz;
    private final UserDirectory directory;
    private final StudentGroups groups;
    private final ZoneId zone;
    private final Clock clock;

    public HomeworkSummaryService(ReviewService reviews, StudentHomeworkService studentHomework, TaskRepository tasks,
            AssignmentRepository assignments, QuizService quiz, UserDirectory directory, StudentGroups groups,
            InstanceTimeZone timeZone, Clock clock) {
        this.reviews = reviews;
        this.studentHomework = studentHomework;
        this.tasks = tasks;
        this.assignments = assignments;
        this.quiz = quiz;
        this.directory = directory;
        this.groups = groups;
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

    /**
     * Students by assignments due in {@code [from, to]} (whole days of the instance time zone). {@code who}: a
     * group or a student; none — every student who has a task on these assignments.
     */
    public Journal journal(LocalDate from, LocalDate to, @Nullable UUID who) {
        Instant now = clock.instant();
        List<Assignment> columns = assignments.findDueBetween(from.atStartOfDay(zone).toInstant(),
                to.plusDays(1).atStartOfDay(zone).toInstant());
        Map<UUID, Map<UUID, HomeworkTask>> byStudent = new HashMap<>();
        List<HomeworkTask> all = columns.isEmpty() ? List.of()
                : tasks.findByAssignments(columns.stream().map(Assignment::id).toList());
        all.forEach(task -> byStudent.computeIfAbsent(task.studentId(), id -> new HashMap<>())
                .put(task.assignmentId(), task));
        Map<UUID, QuizAttempt> scores = quiz.bestAttempts(all.stream()
                .filter(task -> task.status() == TaskStatus.SUBMITTED).map(HomeworkTask::id).toList());
        List<StudentSummary> rows = who == null ? directory.findStudents(byStudent.keySet())
                : directory.findStudents(groups.findGroup(who).map(GroupSummary::memberIds).orElse(List.of(who)));
        return new Journal(
                columns.stream().map(a -> new JournalColumn(a.id(), a.title(), a.dueAt())).toList(),
                rows.stream().filter(StudentSummary::isCurrent)
                        .sorted(Comparator.comparing(StudentSummary::displayName))
                        .map(student -> journalRow(student, columns, byStudent.getOrDefault(student.id(), Map.of()),
                                scores, now))
                        .toList());
    }

    private static JournalRow journalRow(StudentSummary student, List<Assignment> columns,
            Map<UUID, HomeworkTask> given, Map<UUID, QuizAttempt> scores, Instant now) {
        List<JournalCell> cells = columns.stream()
                .map(column -> journalCell(column, given.get(column.id()), scores, now))
                .toList();
        int handedIn = Math.toIntExact(cells.stream()
                .filter(cell -> cell.status() == JournalStatus.ACCEPTED || cell.status() == JournalStatus.TO_REVIEW)
                .count());
        int assigned = Math.toIntExact(cells.stream().filter(cell -> cell.taskId() != null).count());
        return new JournalRow(student.id(), student.displayName(), student.avatar(), cells, handedIn, assigned);
    }

    private static JournalCell journalCell(Assignment column, @Nullable HomeworkTask task,
            Map<UUID, QuizAttempt> scores, Instant now) {
        if (task == null) {
            return new JournalCell(JournalStatus.NOT_ASSIGNED, null, null, null, null, null);
        }
        UUID id = task.id();
        Instant due = column.dueAt();
        return switch (task.status()) {
            case ACCEPTED -> new JournalCell(JournalStatus.ACCEPTED, id, task.grade(), null, null, null);
            case SUBMITTED -> {
                QuizAttempt score = scores.get(id);
                yield new JournalCell(JournalStatus.TO_REVIEW, id, null, score == null ? null : score.scorePoints(),
                        score == null ? null : score.maxPoints(), null);
            }
            case RETURNED -> new JournalCell(JournalStatus.RETURNED, id, null, null, null, null);
            case ASSIGNED -> due != null && now.isAfter(due)
                    ? new JournalCell(JournalStatus.OVERDUE, id, null, null, null,
                            (int) Math.max(1, Duration.between(due, now).toDays()))
                    : new JournalCell(JournalStatus.WAITING, id, null, null, null, null);
        };
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
