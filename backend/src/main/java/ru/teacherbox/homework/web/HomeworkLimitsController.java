package ru.teacherbox.homework.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.homework.application.HomeworkProperties;

/** Limits of attached files for the teacher and the students, so that the browser can check files first. */
@RestController
@RequestMapping("/api/me/homework/limits")
class HomeworkLimitsController {

    private final HomeworkProperties properties;

    HomeworkLimitsController(HomeworkProperties properties) {
        this.properties = properties;
    }

    /**
     * @param maxFileSize       bytes
     * @param maxFilesPerUpload files in one request
     */
    record Limits(long maxFileSize, int maxFilesPerUpload) {
    }

    @GetMapping
    Limits limits() {
        return new Limits(properties.maxFileSize().toBytes(), properties.maxFilesPerUpload());
    }
}
