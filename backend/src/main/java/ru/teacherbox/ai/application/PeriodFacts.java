package ru.teacherbox.ai.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.api.HomeworkJournal;
import ru.teacherbox.homework.api.JournalTask;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.JournalLesson;
import ru.teacherbox.schedule.api.LessonJournal;
import ru.teacherbox.schedule.api.LessonOutcome;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.LessonPlans;

/**
 * The facts of a student's period for the model (ADR-0072): the lessons with their plans and the homework, read on the
 * server through the modules' journals, cut to the budgets and written as plain lines, dates in the instance time
 * zone.
 */
@Component
class PeriodFacts {

    /** The newest lessons and tasks kept; older ones are dropped. */
    static final int MAX_ITEMS = 60;
    static final int MAX_LESSON_SUMMARY = 1_000;
    static final int MAX_REVIEW_COMMENT = 500;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter DAY_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    /**
     * @param lessons  the lines of the lessons, empty without any
     * @param homework the lines of the tasks, empty without any
     */
    record Facts(String lessons, String homework) {

        boolean isEmpty() {
            return lessons.isEmpty() && homework.isEmpty();
        }
    }

    private final LessonJournal lessons;
    private final HomeworkJournal homework;
    private final LessonPlans plans;
    private final InstanceTimeZone timeZone;

    PeriodFacts(LessonJournal lessons, HomeworkJournal homework, LessonPlans plans, InstanceTimeZone timeZone) {
        this.lessons = lessons;
        this.homework = homework;
        this.plans = plans;
        this.timeZone = timeZone;
    }

    Facts of(UUID studentId, LocalDate from, LocalDate to) {
        ZoneId zone = timeZone.zoneId();
        List<JournalLesson> held = newest(lessons.ofStudent(studentId, from, to));
        List<JournalTask> tasks = newest(homework.ofStudent(studentId, from, to));
        List<UUID> planIds = held.stream().map(JournalLesson::planId).filter(Objects::nonNull).distinct().toList();
        Map<UUID, LessonPlanView> planOf = planIds.isEmpty() ? Map.of() : plans.find(planIds).stream()
                .collect(Collectors.toMap(LessonPlanView::id, Function.identity()));
        return new Facts(
                held.stream().map(lesson -> lesson(lesson,
                                lesson.planId() == null ? null : planOf.get(lesson.planId()), zone))
                        .collect(Collectors.joining("\n")),
                tasks.stream().map(task -> task(task, zone)).collect(Collectors.joining("\n")));
    }

    private static <T> List<T> newest(List<T> oldestFirst) {
        return oldestFirst.size() > MAX_ITEMS ? oldestFirst.subList(oldestFirst.size() - MAX_ITEMS, oldestFirst.size())
                : oldestFirst;
    }

    private static String lesson(JournalLesson lesson, @Nullable LessonPlanView plan, ZoneId zone) {
        List<String> head = new ArrayList<>();
        head.add(DAY_TIME.format(lesson.startsAt().atZone(zone)) + ", " + lesson.durationMinutes() + " мин"
                + (lesson.groupId() == null ? "" : ", групповой урок"));
        if (lesson.title() != null) {
            head.add("«" + lesson.title() + "»");
        }
        if (lesson.topic() != null) {
            head.add("тема: " + lesson.topic());
        }
        head.add(outcome(lesson));
        StringBuilder line = new StringBuilder("— ").append(String.join("; ", head));
        if (plan != null) {
            line.append("\n  План урока: ").append(plan(plan));
        }
        // with a plan the summary holds only the deviations from it, none — all by the plan (466.3)
        boolean byPlan = lesson.planId() != null;
        if (lesson.summary() != null) {
            line.append(byPlan ? "\n  Не по плану: " : "\n  Что прошли: ")
                    .append(AiAssistant.cut(lesson.summary(), MAX_LESSON_SUMMARY));
        } else if (byPlan && lesson.outcome() == LessonOutcome.ATTENDED) {
            line.append("\n  Прошли по плану");
        }
        if (lesson.nextPlan() != null) {
            line.append("\n  На следующий урок: ").append(lesson.nextPlan());
        }
        return line.toString();
    }

    private static String outcome(JournalLesson lesson) {
        return switch (lesson.outcome()) {
            case PLANNED -> "не отмечен";
            case ATTENDED -> "был на уроке";
            case MISSED -> "пропустил";
            case LATE_CANCELLED -> "отменил поздно, засчитан как пропуск";
            case EXCUSED -> "заранее предупредил, что не придёт";
            case CANCELLED -> lesson.cancelledBy() == CancelledBy.STUDENT ? "отменён по просьбе ученика"
                    : "отменён учителем";
        };
    }

    private static String plan(LessonPlanView plan) {
        List<String> parts = new ArrayList<>();
        parts.add("«" + plan.title() + "»");
        if (!plan.textbooks().isEmpty()) {
            parts.add("учебники: " + plan.textbooks().stream()
                    .map(book -> "«" + book.title() + "»" + (book.pages() == null ? "" : " с. " + book.pages()))
                    .collect(Collectors.joining(", ")));
        }
        List<String> videos = plan.videos().stream().map(LessonPlanView.Video::title).filter(Objects::nonNull)
                .map(title -> "«" + title + "»").toList();
        if (!videos.isEmpty()) {
            parts.add("видео: " + String.join(", ", videos));
        }
        return String.join("; ", parts);
    }

    private static String task(JournalTask task, ZoneId zone) {
        StringBuilder line = new StringBuilder("— «").append(task.title()).append("»: выдано ")
                .append(day(task.assignedAt(), zone));
        if (task.dueAt() != null) {
            line.append(", срок ").append(day(task.dueAt(), zone));
        }
        if (task.submittedAt() != null) {
            line.append("; сдано ").append(day(task.submittedAt(), zone))
                    .append(task.handedInOnTime() ? " вовремя" : " с опозданием");
        }
        line.append("; ").append(switch (task.status()) {
            case ASSIGNED -> "не сдано";
            case SUBMITTED -> "ждёт проверки";
            case RETURNED -> "возвращено на доработку";
            case ACCEPTED -> "принято";
        });
        if (task.grade() != null) {
            line.append(", оценка ").append(task.grade());
        }
        if (task.teacherComment() != null && !task.teacherComment().isBlank()) {
            line.append("\n  Комментарий учителя: ")
                    .append(AiAssistant.cut(task.teacherComment().strip(), MAX_REVIEW_COMMENT));
        }
        return line.toString();
    }

    private static String day(Instant moment, ZoneId zone) {
        return DAY.format(moment.atZone(zone));
    }
}
