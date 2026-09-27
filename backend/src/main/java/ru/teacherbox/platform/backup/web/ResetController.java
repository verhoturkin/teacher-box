package ru.teacherbox.platform.backup.web;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.backup.ResetService;
import ru.teacherbox.platform.backup.ResetService.ResetResult;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/** The teacher deletes all data of the portal after a backup (ADR-0014). */
@RestController
class ResetController {

    private final ResetService resets;

    ResetController(ResetService resets) {
        this.resets = resets;
    }

    @PostMapping("/api/teacher/reset")
    ResetResult reset(CurrentUser user, @Valid @RequestBody BackupController.RestoreRequest request) {
        ResetResult result = resets.reset(user.id(), request.password());
        AuditLog.teacher(user.id(), "reset", "before it " + result.backup());
        return result;
    }
}
