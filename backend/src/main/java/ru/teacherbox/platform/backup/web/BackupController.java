package ru.teacherbox.platform.backup.web;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.backup.BackupService;
import ru.teacherbox.platform.backup.BackupService.BackupInfo;

/** The teacher lists, creates, downloads and deletes backups. */
@RestController
@RequestMapping("/api/teacher/backups")
class BackupController {

    private final BackupService backups;

    BackupController(BackupService backups) {
        this.backups = backups;
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

    @DeleteMapping("/{name}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String name) {
        backups.delete(name);
    }
}
