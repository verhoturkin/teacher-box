package ru.teacherbox.homework.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.HomeworkSummaryService;
import ru.teacherbox.homework.application.HomeworkViews.MyHomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.homework.domain.InteractiveResult;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;

/** Homework in the student's personal area. */
@RestController
@RequestMapping("/api/me/homework")
class MyHomeworkController {

    record AnswerRequest(
            @NotBlank @Size(max = InteractiveResult.MAX_QUESTION) String question,
            @Size(max = InteractiveResult.MAX_ANSWER) @Nullable String answer,
            @Nullable Boolean correct) {
    }

    record ResultRequest(
            @Min(0) @Max(InteractiveResult.MAX_SCORE) @Nullable Integer score,
            @Min(1) @Max(InteractiveResult.MAX_SCORE) @Nullable Integer maxScore,
            @Size(max = InteractiveResult.MAX_ANSWERS) @Nullable List<@Valid @NotNull AnswerRequest> answers) {

        InteractiveResult toResult() {
            return new InteractiveResult(score, maxScore, answers == null ? List.of() : answers.stream()
                    .map(a -> new InteractiveResult.Answer(a.question(), a.answer(), a.correct()))
                    .toList());
        }
    }

    /** @param result what the page of interactive homework reported */
    record DoneRequest(@Valid @Nullable ResultRequest result) {
    }

    private final StudentHomeworkService homework;
    private final HomeworkSummaryService summaries;

    MyHomeworkController(StudentHomeworkService homework, HomeworkSummaryService summaries) {
        this.homework = homework;
        this.summaries = summaries;
    }

    @GetMapping("/summary")
    MyHomeworkSummary summary(CurrentUser user) {
        return summaries.studentSummary(studentId(user));
    }

    @GetMapping
    List<MyTask> tasks(CurrentUser user) {
        return homework.tasks(studentId(user));
    }

    @GetMapping("/tasks/{taskId}")
    TaskDetails task(CurrentUser user, @PathVariable UUID taskId) {
        return homework.task(studentId(user), taskId);
    }

    /** Multipart: optional {@code text} and optional {@code files}; at least one of them is required. */
    @PostMapping(path = "/tasks/{taskId}/submissions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    TaskDetails submit(CurrentUser user, @PathVariable UUID taskId,
            @RequestParam(name = "text", required = false) @Nullable String text,
            @RequestParam(name = "files", required = false) @Nullable List<MultipartFile> files) {
        return homework.submit(studentId(user), taskId, text, FileResponses.uploaded(files));
    }

    /** Homework on a board or interactive homework: «Готово», with the result of an interactive page. */
    @PostMapping("/tasks/{taskId}/done")
    TaskDetails done(CurrentUser user, @PathVariable UUID taskId, @Valid @RequestBody DoneRequest request) {
        return homework.markDone(studentId(user), taskId,
                request.result() == null ? null : request.result().toResult());
    }

    @GetMapping("/attachments/{attachmentId}")
    ResponseEntity<Resource> download(CurrentUser user, @PathVariable UUID attachmentId) {
        return FileResponses.download(homework.download(studentId(user), attachmentId));
    }

    /** The pages of a textbook bound to the task: a PDF cut to them, any other file whole. */
    @GetMapping("/tasks/{taskId}/textbooks/{textbookId}")
    ResponseEntity<Resource> textbook(CurrentUser user, @PathVariable UUID taskId, @PathVariable UUID textbookId) {
        return FileResponses.download(homework.textbook(studentId(user), taskId, textbookId));
    }

    private static UUID studentId(CurrentUser user) {
        if (user.isTeacher()) {
            throw new ForbiddenException("homework.students-only", "This area is available to students only");
        }
        return user.id();
    }
}
