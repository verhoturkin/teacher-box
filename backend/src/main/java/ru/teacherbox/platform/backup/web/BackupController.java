package ru.teacherbox.platform.backup.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.file.Path;
import java.util.List;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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

/** The teacher lists, creates, downloads, deletes and restores backups. */
@RestController
@RequestMapping("/api/teacher/backups")
class BackupController {

    /** @param password the user's own password: restoring replaces all data */
    record RestoreRequest(@NotBlank @Size(max = 128) String password) {
    }

    private final BackupService backups;
    private final RestoreService restores;

    BackupController(BackupService backups, RestoreService restores) {
        this.backups = backups;
        this.restores = restores;
    }

    @GetMapping
    List<BackupInfo> list() {
        return backups.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BackupInfo create() {
        return backups.create();
    }

    @GetMapping("/{name}")
    ResponseEntity<Resource> download(@PathVariable String name) {
        Path file = backups.file(name);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new FileSystemResource(file));
    }

    @PostMapping("/{name}/restore")
    @ResponseStatus(HttpStatus.ACCEPTED)
    RestoreRequested restore(CurrentUser user, @PathVariable String name, @Valid @RequestBody RestoreRequest request) {
        RestoreRequested requested = restores.request(name, user.id(), request.password());
        AuditLog.teacher(user.id(), "backup-restore", name + ", before it " + requested.safetyBackup());
        return requested;
    }

    @GetMapping("/restore")
    RestoreStatus restoreStatus() {
        return restores.status();
    }

    @DeleteMapping("/{name}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String name) {
        backups.delete(name);
    }
}
