package ru.teacherbox.homework.web;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.HomeworkSummaryService;
import ru.teacherbox.homework.application.HomeworkViews.MyHomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.QuizService;
import ru.teacherbox.homework.application.QuizViews.AnswerInput;
import ru.teacherbox.homework.application.QuizViews.QuizView;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;

/** Homework in the student's personal area. */
@RestController
@RequestMapping("/api/me/homework")
class MyHomeworkController {

    private final StudentHomeworkService homework;
    private final HomeworkSummaryService summaries;
    private final QuizService quiz;

    MyHomeworkController(StudentHomeworkService homework, HomeworkSummaryService summaries, QuizService quiz) {
        this.quiz = quiz;
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

    @GetMapping("/tasks/{taskId}/quiz")
    QuizView quiz(CurrentUser user, @PathVariable UUID taskId) {
        return quiz.quiz(studentId(user), taskId);
    }

    @PostMapping("/tasks/{taskId}/quiz/attempts")
    @ResponseStatus(HttpStatus.CREATED)
    QuizView startAttempt(CurrentUser user, @PathVariable UUID taskId) {
        return quiz.start(studentId(user), taskId);
    }

    /** Autosave of one answer. */
    @PutMapping("/tasks/{taskId}/quiz/attempts/{attemptId}/answers/{questionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void saveAnswer(CurrentUser user, @PathVariable UUID taskId, @PathVariable UUID attemptId,
            @PathVariable UUID questionId, @RequestBody AnswerInput answer) {
        quiz.saveAnswer(studentId(user), taskId, attemptId, questionId, answer);
    }

    @PostMapping("/tasks/{taskId}/quiz/attempts/{attemptId}/submit")
    QuizView submitAttempt(CurrentUser user, @PathVariable UUID taskId, @PathVariable UUID attemptId) {
        return quiz.submit(studentId(user), taskId, attemptId);
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
