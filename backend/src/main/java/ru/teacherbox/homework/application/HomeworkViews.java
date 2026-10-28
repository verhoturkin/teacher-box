package ru.teacherbox.homework.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.homework.domain.AssignmentVideo;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.TaskStatus;
import ru.teacherbox.homework.domain.VideoLink;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Option;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Pair;
import ru.teacherbox.homework.application.QuizViews.QuizReview;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.QuestionType;
import ru.teacherbox.homework.domain.quiz.RevealRule;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.homework.domain.quiz.SingleChoice;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.TextbookSummary;

/** Read models of the homework API. */
public final class HomeworkViews {

    private HomeworkViews() {
    }

    public record AttachmentView(UUID id, String filename, String contentType, long size, Instant uploadedAt) {

        static AttachmentView of(Attachment attachment) {
            return new AttachmentView(attachment.id(), attachment.filename(), attachment.contentType(),
                    attachment.size(), attachment.uploadedAt());
        }
    }

    /**
     * A textbook of an assignment (ADR-0033).
     *
     * @param pages the bound pages ({@code 1-3, 7}); {@code null} — the whole textbook
     */
    public record BoundTextbookView(UUID textbookId, TextbookKind kind, String title, @Nullable String course,
            TextbookFormat format, @Nullable Integer pageCount, @Nullable String pages) {

        static BoundTextbookView of(TextbookSummary textbook, @Nullable String pages) {
            return new BoundTextbookView(textbook.id(), textbook.kind(), textbook.title(), textbook.course(),
                    textbook.format(), textbook.pageCount(), pages);
        }
    }

    /**
     * A video of an assignment the teacher gives (ADR-0047).
     *
     * @param transcript      lines {@code [m:ss] text}; blank — none
     * @param transcriptShown the student sees the transcript
     */
    public record VideoInput(String url, @Nullable String title, @Nullable String transcript,
            boolean transcriptShown) {
    }

    /**
     * A video of an assignment (ADR-0047).
     *
     * @param videoId      the video on its platform; {@code null} — a plain link opened in a new tab
     * @param startSeconds where the player starts; {@code null} — from the beginning
     * @param transcript   {@code null} — none, or hidden from the student
     */
    public record VideoView(String url, VideoLink.Provider provider, @Nullable String videoId,
            @Nullable Integer startSeconds, @Nullable String title, @Nullable String transcript,
            boolean transcriptShown) {

        static VideoView of(AssignmentVideo video, boolean teacher) {
            VideoLink link = video.link();
            return new VideoView(link.url(), link.provider(), link.videoId(), link.startSeconds(), video.title(),
                    teacher || video.transcriptShown() ? video.transcript() : null, video.transcriptShown());
        }
    }

    /**
     * A row of the teacher's list of assignments.
     *
     * @param students the names of its students, alphabetically
     * @param boardId  the board it was put on; {@code null} — none
     */
    public record AssignmentSummary(
            UUID id,
            String title,
            @Nullable Instant dueAt,
            Instant createdAt,
            List<String> students,
            @Nullable UUID boardId,
            int totalTasks,
            int assigned,
            int submitted,
            int returned,
            int accepted) {
    }

    /**
     * Progress of one student on an assignment.
     *
     * @param studentAvatar address of the student's photo; {@code null}: none
     */
    public record TaskSummary(
            UUID taskId,
            UUID studentId,
            String studentName,
            @Nullable String studentAvatar,
            TaskStatus status,
            @Nullable String grade,
            @Nullable Instant submittedAt,
            @Nullable Instant reviewedAt,
            boolean overdue) {
    }

    /** @param boardId the board the assignment was put on; {@code null} — none */
    public record AssignmentDetails(
            UUID id,
            String title,
            @Nullable String description,
            @Nullable Instant dueAt,
            @Nullable UUID boardId,
            Instant createdAt,
            long version,
            List<AttachmentView> attachments,
            List<TaskSummary> tasks,
            List<BoundTextbookView> textbooks,
            List<VideoView> videos,
            List<QuestionView> questions,
            RevealRule quizReveal,
            @Nullable Integer quizAttempts) {
    }

    /**
     * A question as the teacher sees it, with the key (ADR-0052); the fields of other types are empty.
     *
     * @param options  choices, or the items of an ordering in the right order
     * @param correct  ids of the right choices
     * @param accepted accepted texts of a short text
     * @param value    the number, with {@code tolerance}
     * @param pairs    matching pairs
     */
    public record QuestionView(UUID id, QuestionType type, String text, int points, @Nullable String explanation,
            List<Option> options, List<UUID> correct, List<String> accepted, @Nullable BigDecimal value,
            @Nullable BigDecimal tolerance, List<Pair> pairs) {

        static QuestionView of(Question q) {
            List<Option> options = List.of();
            List<UUID> correct = List.of();
            List<String> accepted = List.of();
            BigDecimal value = null;
            BigDecimal tolerance = null;
            List<Pair> pairs = List.of();
            switch (q) {
                case SingleChoice s -> {
                    options = s.options();
                    correct = List.of(s.correct());
                }
                case MultipleChoice m -> {
                    options = m.options();
                    correct = m.options().stream().map(Option::id).filter(m.correct()::contains).toList();
                }
                case ShortText t -> accepted = t.accepted();
                case Numeric n -> {
                    value = n.value();
                    tolerance = n.tolerance();
                }
                case Matching m -> pairs = m.pairs();
                case Ordering o -> options = o.items();
            }
            return new QuestionView(q.id(), q.type(), q.text(), q.points(), q.explanation(), options, correct,
                    accepted, value, tolerance, pairs);
        }
    }

    public record SubmissionView(UUID id, @Nullable String text, Instant submittedAt, List<AttachmentView> attachments) {
    }

    /**
     * The assignment as the student sees it inside a task.
     *
     * @param boardId the board the assignment was put on; {@code null} — none
     */
    public record AssignmentInfo(
            UUID id,
            String title,
            @Nullable String description,
            @Nullable Instant dueAt,
            @Nullable UUID boardId,
            List<AttachmentView> attachments,
            List<BoundTextbookView> textbooks,
            List<VideoView> videos) {
    }

    /** A task with the assignment, all submissions (newest first) and the review; {@code quiz} — teacher only. */
    public record TaskDetails(
            UUID taskId,
            UUID studentId,
            String studentName,
            TaskStatus status,
            @Nullable String grade,
            @Nullable String teacherComment,
            Instant assignedAt,
            @Nullable Instant submittedAt,
            @Nullable Instant reviewedAt,
            boolean overdue,
            AssignmentInfo assignment,
            List<SubmissionView> submissions,
            @Nullable QuizReview quiz) {
    }

    /** @param studentAvatar address of the student's photo; {@code null}: none */
    public record ReviewQueueItem(
            UUID taskId,
            UUID assignmentId,
            String title,
            UUID studentId,
            String studentName,
            @Nullable String studentAvatar,
            @Nullable Instant submittedAt,
            @Nullable Instant dueAt) {
    }

    /** A row of the student's list of tasks. */
    public record MyTask(
            UUID taskId,
            UUID assignmentId,
            String title,
            @Nullable Instant dueAt,
            TaskStatus status,
            @Nullable String grade,
            boolean overdue,
            Instant assignedAt,
            @Nullable Instant reviewedAt) {
    }

    /**
     * Homework at a glance for the teacher.
     *
     * @param toReview       submitted works waiting for review
     * @param overdue        open tasks of current students past their due date
     * @param dueSoon        open tasks of current students due within the next days
     * @param oldestToReview the works waiting longest
     * @param weekAssigned   assignments given to current students in the current calendar week (Monday to Sunday,
     *                       instance time zone)
     * @param weekOnTime     works of current students handed in during that week not later than the due date
     *                       (a task without a due date counts)
     */
    public record HomeworkSummary(int toReview, int overdue, int dueSoon, List<ReviewQueueItem> oldestToReview,
            int weekAssigned, int weekOnTime) {
    }

    /**
     * A student's homework at a glance.
     *
     * @param open     tasks the student still has to do
     * @param overdue  open tasks past their due date
     * @param upcoming open tasks, the nearest due date first (tasks without a date last)
     */
    public record MyHomeworkSummary(int open, int overdue, List<MyTask> upcoming) {
    }
}
