package ru.teacherbox.homework.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkSummaryService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentSummary;
import ru.teacherbox.homework.application.HomeworkViews.AttachmentView;
import ru.teacherbox.homework.application.HomeworkViews.HomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.ReviewQueueItem;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.ReviewService;

/** The teacher's homework API. */
@RestController
@RequestMapping("/api/teacher/homework")
class TeacherHomeworkController {

    record CreateAssignmentRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @Nullable Instant dueAt,
            @Nullable List<UUID> studentIds) {
    }

    record UpdateAssignmentRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @Nullable Instant dueAt,
            @NotNull Long version) {
    }

    record AssignStudentsRequest(@NotNull @Size(min = 1) List<UUID> studentIds) {
    }

    record ReviewRequest(
            @NotNull ReviewService.Decision decision,
            @Size(max = 20) @Nullable String grade,
            @Size(max = 5_000) @Nullable String comment) {
    }

    private final AssignmentService assignments;
    private final ReviewService reviews;
    private final HomeworkSummaryService summaries;

    TeacherHomeworkController(AssignmentService assignments, ReviewService reviews,
            HomeworkSummaryService summaries) {
        this.assignments = assignments;
        this.reviews = reviews;
        this.summaries = summaries;
    }

    @GetMapping("/summary")
    HomeworkSummary summary() {
        return summaries.teacherSummary();
    }

    @GetMapping("/assignments")
    List<AssignmentSummary> list() {
        return assignments.list();
    }

    @PostMapping("/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    AssignmentDetails create(@Valid @RequestBody CreateAssignmentRequest request) {
        return assignments.create(request.title(), request.description(), request.dueAt(),
                request.studentIds() == null ? List.of() : request.studentIds());
    }

    @GetMapping("/assignments/{assignmentId}")
    AssignmentDetails get(@PathVariable UUID assignmentId) {
        return assignments.get(assignmentId);
    }

    @PutMapping("/assignments/{assignmentId}")
    AssignmentDetails update(@PathVariable UUID assignmentId, @Valid @RequestBody UpdateAssignmentRequest request) {
        return assignments.update(assignmentId, request.title(), request.description(), request.dueAt(),
                request.version());
    }

    @PostMapping("/assignments/{assignmentId}/students")
    AssignmentDetails assign(@PathVariable UUID assignmentId, @Valid @RequestBody AssignStudentsRequest request) {
        return assignments.assign(assignmentId, request.studentIds());
    }

    @PostMapping(path = "/assignments/{assignmentId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    List<AttachmentView> addAttachments(@PathVariable UUID assignmentId,
            @RequestParam("files") List<MultipartFile> files) {
        return assignments.addAttachments(assignmentId, FileResponses.uploaded(files));
    }

    @DeleteMapping("/assignments/{assignmentId}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeAttachment(@PathVariable UUID assignmentId, @PathVariable UUID attachmentId) {
        assignments.removeAttachment(assignmentId, attachmentId);
    }

    @GetMapping("/attachments/{attachmentId}")
    ResponseEntity<Resource> download(@PathVariable UUID attachmentId) {
        return FileResponses.download(assignments.download(attachmentId));
    }

    @GetMapping("/review-queue")
    List<ReviewQueueItem> reviewQueue() {
        return reviews.queue();
    }

    @GetMapping("/tasks/{taskId}")
    TaskDetails task(@PathVariable UUID taskId) {
        return reviews.task(taskId);
    }

    @PostMapping("/tasks/{taskId}/review")
    TaskDetails review(@PathVariable UUID taskId, @Valid @RequestBody ReviewRequest request) {
        return reviews.review(taskId, request.decision(), request.grade(), request.comment());
    }
}
