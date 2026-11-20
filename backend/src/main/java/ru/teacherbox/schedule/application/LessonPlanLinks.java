package ru.teacherbox.schedule.application;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.LessonPlans;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.Textbooks;

/**
 * The lesson plan of a lesson (roadmap 11): the link lives in {@code schedule.lessons.plan_id}, the plan itself in
 * {@code textbooks}. The teacher links it; the students of the lesson and their guardians read it.
 */
@Service
public class LessonPlanLinks {

    /**
     * A lesson plan as a student of the lesson sees it: a transcript only when the teacher shows it.
     *
     * @param textbooks the bound textbooks that still exist; their pages are read one by one
     */
    public record StudentLessonPlan(UUID id, String title, String body, List<LessonPlanView.Textbook> textbooks,
            List<LessonPlanView.Video> videos) {

        static StudentLessonPlan of(LessonPlanView plan) {
            return new StudentLessonPlan(plan.id(), plan.title(), plan.body(), plan.textbooks(),
                    plan.videos().stream().map(StudentLessonPlan::visible).toList());
        }

        private static LessonPlanView.Video visible(LessonPlanView.Video video) {
            return video.transcriptShown() ? video
                    : new LessonPlanView.Video(video.url(), video.provider(), video.videoId(), video.startSeconds(),
                            video.title(), null, false);
        }
    }

    private final LessonRepository lessons;
    private final ScheduleQueries queries;
    private final LessonPlans plans;
    private final Textbooks textbooks;

    LessonPlanLinks(LessonRepository lessons, ScheduleQueries queries, LessonPlans plans, Textbooks textbooks) {
        this.lessons = lessons;
        this.queries = queries;
        this.plans = plans;
        this.textbooks = textbooks;
    }

    /**
     * Puts a working plan on the lesson or takes the plan off ({@code null}); no lesson version: the link never
     * conflicts with time edits. Replacing a plan leaves the previous one in {@code textbooks}.
     *
     * @throws NotFoundException  {@code schedule.lesson-not-found}, {@code textbooks.plan-not-found}
     * @throws ConflictException  {@code schedule.bank-item} — a bank original; {@code schedule.plan-linked} — the
     *                            plan is on another lesson
     * @throws ru.teacherbox.shared.error.BusinessRuleException {@code schedule.lesson-cancelled} — a new plan on a
     *                            cancelled lesson
     */
    @Transactional
    public LessonView link(UUID lessonId, @Nullable UUID planId) {
        Lesson lesson = lessons.findById(lessonId).orElseThrow(LessonPlanLinks::lessonNotFound);
        lesson.linkPlan(planId);
        if (planId != null) {
            checkLinkable(planId);
        }
        if (!lessons.updatePlan(lesson)) {
            throw new ConflictException("schedule.plan-linked", "The plan is already on another lesson");
        }
        return queries.lesson(lessonId);
    }

    /** The plan of the student's lesson; another student's lesson or a lesson without a plan is not found. */
    @Transactional(readOnly = true)
    public StudentLessonPlan studentPlan(UUID studentId, UUID lessonId) {
        return StudentLessonPlan.of(plan(studentId, lessonId));
    }

    /** The pages of a textbook of the student's lesson plan: as bound, a PDF cut to them, any other file whole. */
    @Transactional(readOnly = true)
    public TextbookContent studentTextbook(UUID studentId, UUID lessonId, UUID textbookId) {
        LessonPlanView.Textbook textbook = plan(studentId, lessonId).textbooks().stream()
                .filter(found -> found.id().equals(textbookId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("schedule.textbook-not-found", "Textbook not found"));
        return textbook.pages() == null
                ? textbooks.file(textbookId)
                : textbooks.content(textbookId, PageRanges.parse(textbook.pages()));
    }

    private void checkLinkable(UUID planId) {
        try {
            plans.checkLinkable(planId);
        } catch (ConflictException exception) {
            throw new ConflictException("schedule.bank-item", "A bank original never goes on a lesson");
        }
    }

    private LessonPlanView plan(UUID studentId, UUID lessonId) {
        UUID planId = lessons.findById(lessonId)
                .filter(lesson -> lesson.hasParticipant(studentId))
                .orElseThrow(LessonPlanLinks::lessonNotFound)
                .planId();
        List<LessonPlanView> found = planId == null ? List.of() : plans.find(List.of(planId));
        if (found.isEmpty()) {
            throw new NotFoundException("schedule.plan-not-found", "The lesson has no plan");
        }
        return found.getFirst();
    }

    private static NotFoundException lessonNotFound() {
        return new NotFoundException("schedule.lesson-not-found", "Lesson not found");
    }
}
