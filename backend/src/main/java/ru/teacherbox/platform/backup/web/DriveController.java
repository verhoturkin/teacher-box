package ru.teacherbox.platform.backup.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.backup.drive.CloudBackupService;
import ru.teacherbox.platform.backup.drive.CloudBackupService.CloudBackup;
import ru.teacherbox.platform.backup.drive.CloudBackupService.DriveStatus;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The teacher's Google Drive for the backups (ADR-0037): the OAuth client, connecting, disconnecting,
 * the copies there, sending a backup there and bringing one back to the server.
 */
@RestController
@RequestMapping("/api/teacher/backups/google")
class DriveController {

    record ClientRequest(@NotBlank @Size(max = 300) String clientId, @NotBlank @Size(max = 300) String clientSecret) {
    }

    /** @param origin the address the teacher opened the portal with */
    record AuthorizeRequest(@NotBlank @Size(max = 300) String origin) {
    }

    record AuthorizeResponse(String url) {
    }

    private final CloudBackupService drive;

    DriveController(CloudBackupService drive) {
        this.drive = drive;
    }

    @GetMapping
    DriveStatus status() {
        return drive.status();
    }

    @PutMapping("/client")
    DriveStatus saveClient(@Valid @RequestBody ClientRequest request) {
        drive.saveClient(request.clientId(), request.clientSecret());
        return drive.status();
    }

    @PostMapping("/authorize")
    AuthorizeResponse authorize(@Valid @RequestBody AuthorizeRequest request) {
        return new AuthorizeResponse(drive.authorize(request.origin()));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void disconnect(CurrentUser user) {
        drive.disconnect();
        AuditLog.teacher(user.id(), "backup-drive-disconnect", "");
    }

    @GetMapping("/files")
    List<CloudBackup> files() {
        return drive.list();
    }

    /** Sends a backup of the server to the Drive in the background. */
    @PostMapping("/uploads/{name}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    DriveStatus upload(@PathVariable String name) {
        drive.requestUpload(name);
        return drive.status();
    }

    /** Brings a backup from the Drive to the server in the background. */
    @PostMapping("/files/{id}/download")
    @ResponseStatus(HttpStatus.ACCEPTED)
    CloudBackup download(CurrentUser user, @PathVariable String id) {
        CloudBackup backup = drive.requestDownload(id);
        AuditLog.teacher(user.id(), "backup-drive-download", backup.name());
        return backup;
    }
}
