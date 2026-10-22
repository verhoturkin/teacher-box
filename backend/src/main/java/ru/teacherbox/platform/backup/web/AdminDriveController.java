package ru.teacherbox.platform.backup.web;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.backup.drive.CloudBackupService;
import ru.teacherbox.platform.backup.drive.CloudBackupService.CloudBackup;
import ru.teacherbox.platform.backup.drive.CloudBackupService.DriveStatus;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/** Technical cloud backup operations; archives stay on the server and account details stay private. */
@RestController
@RequestMapping("/api/admin/backups/google")
class AdminDriveController {

    private final CloudBackupService drive;

    AdminDriveController(CloudBackupService drive) {
        this.drive = drive;
    }

    @GetMapping
    DriveStatus status() {
        DriveStatus status = drive.status();
        return new DriveStatus(status.clientConfigured(), status.clientFromEnvironment(), null,
                status.connected(), null, status.connectedAt(), status.lastUploadAt(),
                status.lastUploadName(), null, status.running(), status.callbackPath());
    }

    @GetMapping("/files")
    List<CloudBackup> files() {
        return drive.list();
    }

    @PostMapping("/uploads/{name}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    DriveStatus upload(CurrentUser user, @PathVariable String name) {
        drive.requestUpload(name);
        AuditLog.record(user.id(), "backup-drive-upload", name);
        return status();
    }

    @PostMapping("/files/{id}/download")
    @ResponseStatus(HttpStatus.ACCEPTED)
    CloudBackup download(CurrentUser user, @PathVariable String id) {
        CloudBackup backup = drive.requestDownload(id);
        AuditLog.record(user.id(), "backup-drive-download", backup.name());
        return backup;
    }
}
