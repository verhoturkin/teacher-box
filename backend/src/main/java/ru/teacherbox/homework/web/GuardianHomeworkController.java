package ru.teacherbox.homework.web;

import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.homework.application.HomeworkSummaryService;
import ru.teacherbox.homework.application.HomeworkViews.MyHomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.QuizService;
import ru.teacherbox.homework.application.QuizViews.QuizView;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;

/**
 * The family cabinet (ADR-0069): a guardian reads a child's homework as the child sees it — tasks with texts,
 * answers and the teacher's comments, the quiz, files and bound textbook pages — through the same services as
 * {@code /api/me/homework} after {@link GuardianAccess#require}. Read-only: no submissions, no quiz attempts.
 */
@RestController
@RequestMapping("/api/guardian/students/{studentId}/homework")
class GuardianHomeworkController {

    private final GuardianAccess access;
    private final StudentHomeworkService homework;
    private final HomeworkSummaryService summaries;
    private final QuizService quiz;

    GuardianHomeworkController(GuardianAccess access, StudentHomeworkService homework,
            HomeworkSummaryService summaries, QuizService quiz) {
        this.access = access;
        this.homework = homework;
        this.summaries = summaries;
        this.quiz = quiz;
    }

    @GetMapping("/summary")
    MyHomeworkSummary summary(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return summaries.studentSummary(studentId);
    }

    @GetMapping
    List<MyTask> tasks(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return homework.tasks(studentId);
    }

    @GetMapping("/tasks/{taskId}")
    TaskDetails task(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID taskId) {
        access.require(user, studentId);
        return homework.task(studentId, taskId);
    }

    /** The quiz as the child sees it now: answers and the key only as far as its reveal rule allows. */
    @GetMapping("/tasks/{taskId}/quiz")
    QuizView quiz(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID taskId) {
        access.require(user, studentId);
        return quiz.quiz(studentId, taskId);
    }

    @GetMapping("/attachments/{attachmentId}")
    ResponseEntity<Resource> download(CurrentUser user, @PathVariable UUID studentId,
            @PathVariable UUID attachmentId) {
        access.require(user, studentId);
        return FileResponses.download(homework.download(studentId, attachmentId));
    }

    @GetMapping("/tasks/{taskId}/textbooks/{textbookId}")
    ResponseEntity<Resource> textbook(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID taskId,
            @PathVariable UUID textbookId) {
        access.require(user, studentId);
        return FileResponses.download(homework.textbook(studentId, taskId, textbookId));
    }
}
