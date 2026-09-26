package ru.teacherbox.homework.web;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.HomeworkSummaryService;
import ru.teacherbox.homework.application.HomeworkViews.MyHomeworkSummary;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;

/** Homework in the student's personal area. */
@RestController
@RequestMapping("/api/me/homework")
class MyHomeworkController {

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

    @GetMapping("/attachments/{attachmentId}")
    ResponseEntity<Resource> download(CurrentUser user, @PathVariable UUID attachmentId) {
        return FileResponses.download(homework.download(studentId(user), attachmentId));
    }

    private static UUID studentId(CurrentUser user) {
        if (user.isTeacher()) {
            throw new ForbiddenException("homework.students-only", "This area is available to students only");
        }
        return user.id();
    }
}
