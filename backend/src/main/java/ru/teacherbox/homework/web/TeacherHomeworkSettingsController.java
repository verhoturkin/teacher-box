package ru.teacherbox.homework.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.homework.application.DueSoonWindow;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/** The teacher's homework settings (ADR-0056): the reminder before the due date, in force on the next run. */
@RestController
@RequestMapping("/api/teacher/homework/settings")
class TeacherHomeworkSettingsController {

    /** @param dueSoonMinutes 60–4320 (1–72 hours) */
    record HomeworkSettingsRequest(@NotNull Integer dueSoonMinutes) {
    }

    record HomeworkSettingsView(long dueSoonMinutes) {

        static HomeworkSettingsView of(Duration window) {
            return new HomeworkSettingsView(window.toMinutes());
        }
    }

    private final DueSoonWindow window;

    TeacherHomeworkSettingsController(DueSoonWindow window) {
        this.window = window;
    }

    @GetMapping
    HomeworkSettingsView settings() {
        return HomeworkSettingsView.of(window.current());
    }

    @PutMapping
    HomeworkSettingsView change(CurrentUser user, @Valid @RequestBody HomeworkSettingsRequest request) {
        Duration changed = window.change(Duration.ofMinutes(request.dueSoonMinutes()));
        AuditLog.record(user.id(), "homework-settings", "due-soon " + changed.toMinutes());
        return HomeworkSettingsView.of(changed);
    }
}
