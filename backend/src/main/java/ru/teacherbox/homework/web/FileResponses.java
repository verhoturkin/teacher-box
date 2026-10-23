package ru.teacherbox.homework.web;

import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.homework.application.AttachmentService.FileDownload;
import ru.teacherbox.homework.application.UploadedFile;
import ru.teacherbox.shared.http.FileDownloads;
import ru.teacherbox.textbooks.api.TextbookContent;

/** Conversions between HTTP and stored files. */
final class FileResponses {

    private FileResponses() {
    }

    /** Always a download (never rendered inline), with the type fixed on upload and sniffing disabled. */
    static ResponseEntity<Resource> download(FileDownload file) {
        return FileDownloads.download(file.attachment().filename(), file.attachment().contentType(),
                file.attachment().size(), file.content());
    }

    /** A textbook's file or pages: a download like an attachment. */
    static ResponseEntity<Resource> download(TextbookContent file) {
        return FileDownloads.download(file.filename(), file.contentType(), file.size(), file.content());
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
