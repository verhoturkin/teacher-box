package ru.teacherbox.homework.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentInfo;
import ru.teacherbox.homework.application.HomeworkViews.AttachmentView;
import ru.teacherbox.homework.application.HomeworkViews.SubmissionView;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.Submission;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.SubmissionRepository;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.i18n.Language;

/** Builds the full view of a task (shared by the teacher's and the student's API). */
@Component
class TaskDetailsAssembler {


    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final AttachmentService attachments;
    private final TextbookBindings textbooks;
    private final UserDirectory directory;
    private final Clock clock;

    TaskDetailsAssembler(AssignmentRepository assignments, SubmissionRepository submissions,
            AttachmentService attachments, TextbookBindings textbooks, UserDirectory directory, Clock clock) {
        this.assignments = assignments;
        this.submissions = submissions;
        this.attachments = attachments;
        this.textbooks = textbooks;
        this.directory = directory;
        this.clock = clock;
    }

    TaskDetails details(HomeworkTask task) {
        Assignment assignment = assignments.findById(task.assignmentId())
                .orElseThrow(() -> new IllegalStateException("Task " + task.id() + " has no assignment"));
        List<Submission> taskSubmissions = submissions.findByTask(task.id());
        Map<UUID, List<AttachmentView>> submissionFiles = attachments
                .of(AttachmentOwner.SUBMISSION, taskSubmissions.stream().map(Submission::id).toList())
                .stream()
                .collect(Collectors.groupingBy(Attachment::ownerId,
                        Collectors.mapping(AttachmentView::of, Collectors.toList())));
        List<AttachmentView> assignmentFiles = attachments.of(AttachmentOwner.ASSIGNMENT, assignment.id()).stream()
                .map(AttachmentView::of)
                .toList();
        String studentName = directory.findStudent(task.studentId())
                .map(StudentSummary::displayName)
                .orElseGet(TaskDetailsAssembler::unknownStudent);

        return new TaskDetails(task.id(), task.studentId(), studentName, task.status(), task.grade(),
                task.teacherComment(), task.assignedAt(), task.submittedAt(), task.reviewedAt(),
                task.isOverdue(assignment.dueAt(), clock.instant()),
                new AssignmentInfo(assignment.id(), assignment.kind(), assignment.title(), assignment.description(),
                        assignment.dueAt(), assignmentFiles, textbooks.of(assignment.id())),
                taskSubmissions.stream()
                        .map(submission -> new SubmissionView(submission.id(), submission.text(),
                                submission.result(), submission.submittedAt(), submissionFiles.getOrDefault(submission.id(), List.of())))
                        .toList());
    }

    /** In the language of the page (ADR-0036). */
    static String unknownStudent() {
        return switch (Language.current()) {
            case RU -> "Неизвестный ученик";
            case EN -> "Unknown student";
        };
    }
}
