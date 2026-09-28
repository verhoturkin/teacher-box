package ru.teacherbox.platform.backup.web;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.backup.BackupService;
import ru.teacherbox.platform.backup.BackupService.BackupInfo;
import ru.teacherbox.platform.backup.RestoreService;
import ru.teacherbox.platform.backup.RestoreService.RestoreRequested;
import ru.teacherbox.platform.backup.RestoreService.RestoreStatus;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The administrator lists, creates and restores backups (ADR-0014). No downloads: the backups hold
 * the students' data (ADR-0010).
 */
@RestController
@RequestMapping("/api/admin/backups")
class AdminBackupController {

    private final BackupService backups;
    private final RestoreService restores;

    AdminBackupController(BackupService backups, RestoreService restores) {
        this.backups = backups;
        this.restores = restores;
    }

    @GetMapping
    List<BackupInfo> list() {
        return backups.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BackupInfo create(CurrentUser user) {
        BackupInfo backup = backups.create();
        AuditLog.record(user.id(), "backup-create", backup.name());
        return backup;
    }

    @PostMapping("/{name}/restore")
    @ResponseStatus(HttpStatus.ACCEPTED)
    RestoreRequested restore(CurrentUser user, @PathVariable String name,
            @Valid @RequestBody BackupController.RestoreRequest request) {
        RestoreRequested requested = restores.request(name, user.id(), request.password());
        AuditLog.record(user.id(), "backup-restore", name + ", before it " + requested.safetyBackup());
        return requested;
    }

    @GetMapping("/restore")
    RestoreStatus restoreStatus() {
        return restores.status();
    }
}
