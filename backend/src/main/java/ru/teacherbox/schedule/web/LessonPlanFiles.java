package ru.teacherbox.schedule.web;

import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import ru.teacherbox.shared.http.FileDownloads;
import ru.teacherbox.textbooks.api.TextbookContent;

/** The textbook pages of a lesson plan as an HTTP download. */
final class LessonPlanFiles {

    private LessonPlanFiles() {
    }

    /** Always a download (never rendered inline), like the textbooks of homework. */
    static ResponseEntity<Resource> download(TextbookContent file) {
        return FileDownloads.download(file.filename(), file.contentType(), file.size(), file.content());
    }
}
