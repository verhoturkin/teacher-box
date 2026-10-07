package ru.teacherbox.textbooks.web;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.application.TextbookService.PagePicture;
import ru.teacherbox.textbooks.application.TextbookService.Upload;

/** Conversions between HTTP and the files of textbooks. */
final class TextbookResponses {

    private TextbookResponses() {
    }

    /** Always a download (never rendered inline), with the type found on upload and sniffing disabled. */
    static ResponseEntity<Resource> download(TextbookContent file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(file.content());
    }

    /** A page picture for a board; the browser keeps it for a few minutes. */
    static ResponseEntity<Resource> picture(PagePicture page) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(page.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .body(page.content());
    }

    static Upload upload(MultipartFile file) {
        return new Upload(file.getOriginalFilename(), file.getSize(), file);
    }
}
