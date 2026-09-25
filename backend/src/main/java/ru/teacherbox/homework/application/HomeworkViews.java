package ru.teacherbox.homework.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.TaskStatus;

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

    /** A row of the teacher's list of assignments. */
    public record AssignmentSummary(
            UUID id,
            String title,
            @Nullable Instant dueAt,
            Instant createdAt,
            int totalTasks,
            int assigned,
            int submitted,
            int returned,
            int accepted) {
    }

    /** Progress of one student on an assignment. */
    public record TaskSummary(
            UUID taskId,
            UUID studentId,
            String studentName,
            TaskStatus status,
            @Nullable String grade,
            @Nullable Instant submittedAt,
            @Nullable Instant reviewedAt,
            boolean overdue) {
    }

    public record AssignmentDetails(
            UUID id,
            String title,
            @Nullable String description,
            @Nullable Instant dueAt,
            Instant createdAt,
            long version,
            List<AttachmentView> attachments,
            List<TaskSummary> tasks) {
    }

    public record SubmissionView(UUID id, @Nullable String text, Instant submittedAt, List<AttachmentView> attachments) {
    }

    /** The assignment as the student sees it inside a task. */
    public record AssignmentInfo(
            UUID id,
            String title,
            @Nullable String description,
            @Nullable Instant dueAt,
            List<AttachmentView> attachments) {
    }

    /** A task with the assignment, all submissions (newest first) and the review. */
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
            List<SubmissionView> submissions) {
    }

    public record ReviewQueueItem(
            UUID taskId,
            UUID assignmentId,
            String title,
            UUID studentId,
            String studentName,
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
}
