package ru.teacherbox.schedule.application;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.api.Assignments;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * The homework of a lesson (roadmap 11): the links live in {@code schedule.lesson_assignments}, the assignments in
 * {@code homework}. Many assignments per lesson, an assignment on at most one lesson. No lesson version: a link never
 * conflicts with time edits, as the summary and the plan.
 */
@Service
public class LessonHomeworkLinks {

    private static final Logger log = LoggerFactory.getLogger(LessonHomeworkLinks.class);

    private final LessonRepository lessons;
    private final ScheduleQueries queries;
    private final Assignments assignments;

    LessonHomeworkLinks(LessonRepository lessons, ScheduleQueries queries, Assignments assignments) {
        this.lessons = lessons;
        this.queries = queries;
        this.assignments = assignments;
    }

    /**
     * Links a working assignment to the lesson after its other homework; linking it again to the same lesson changes
     * nothing.
     *
     * @throws NotFoundException  {@code schedule.lesson-not-found}, {@code assignment.not-found}
     * @throws ConflictException  {@code schedule.bank-item} — a bank original; {@code schedule.assignment-linked} — the
     *                            assignment is on another lesson
     * @throws ru.teacherbox.shared.error.BusinessRuleException {@code schedule.lesson-cancelled} — a cancelled lesson
     */
    @Transactional
    public LessonView link(UUID lessonId, UUID assignmentId) {
        Lesson lesson = load(lessonId);
        if (lesson.assignmentIds().contains(assignmentId)) {
            return queries.lesson(lessonId);
        }
        lesson.requireHomeworkLinkable();
        try {
            assignments.checkLinkable(assignmentId);
        } catch (ConflictException exception) {
            throw new ConflictException("schedule.bank-item", "A bank original never goes on a lesson");
        }
        if (!lessons.linkAssignment(lessonId, assignmentId)) {
            throw new ConflictException("schedule.assignment-linked", "The assignment is already on another lesson");
        }
        log.info("Assignment {} linked to lesson {}", assignmentId, lessonId);
        return queries.lesson(lessonId);
    }

    /** Takes the assignment off the lesson (a cancelled one too); the assignment stays in homework. */
    @Transactional
    public LessonView unlink(UUID lessonId, UUID assignmentId) {
        load(lessonId);
        lessons.unlinkAssignment(lessonId, assignmentId);
        return queries.lesson(lessonId);
    }

    private Lesson load(UUID lessonId) {
        return lessons.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("schedule.lesson-not-found", "Lesson not found"));
    }
}
