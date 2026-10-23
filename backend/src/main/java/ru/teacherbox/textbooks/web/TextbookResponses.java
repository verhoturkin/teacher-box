package ru.teacherbox.textbooks.web;

import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.shared.http.FileDownloads;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.application.TextbookService.Cover;
import ru.teacherbox.textbooks.application.TextbookService.PagePicture;
import ru.teacherbox.textbooks.application.TextbookService.Upload;

/** Conversions between HTTP and the files of textbooks. */
final class TextbookResponses {

    private TextbookResponses() {
    }

    /** Always a download (never rendered inline), with the type found on upload and sniffing disabled. */
    static ResponseEntity<Resource> download(TextbookContent file) {
        return FileDownloads.download(file.filename(), file.contentType(), file.size(), file.content());
    }

    /** A page picture for a board; the browser keeps it for a few minutes. */
    static ResponseEntity<Resource> picture(PagePicture page) {
        return picture(page.contentType(), page.content());
    }

    /** A cover is shown in a list: the browser keeps it for a few minutes. */
    static ResponseEntity<Resource> cover(Cover cover) {
        return picture(cover.contentType(), cover.content());
    }

    private static ResponseEntity<Resource> picture(String contentType, Resource content) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .body(content);
    }

    static Upload upload(MultipartFile file) {
        return new Upload(file.getOriginalFilename(), file.getSize(), file);
    }
}
