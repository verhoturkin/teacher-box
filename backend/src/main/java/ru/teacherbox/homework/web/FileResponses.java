package ru.teacherbox.homework.web;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.AttachmentService.FileDownload;
import ru.teacherbox.homework.application.UploadedFile;

/** Conversions between HTTP and stored files. */
final class FileResponses {

    private FileResponses() {
    }

    /** Always a download (never rendered inline), with the type fixed on upload and sniffing disabled. */
    static ResponseEntity<Resource> download(FileDownload file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.attachment().contentType()))
                .contentLength(file.attachment().size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.attachment().filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(file.content());
    }

    static List<UploadedFile> uploaded(@Nullable List<MultipartFile> files) {
        if (files == null) {
            return List.of();
        }
        return files.stream()
                .filter(file -> !file.isEmpty())
                .map(file -> new UploadedFile(
                        file.getOriginalFilename() == null ? file.getName() : file.getOriginalFilename(),
                        file.getSize(), file))
                .toList();
    }
}
