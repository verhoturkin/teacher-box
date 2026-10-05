package ru.teacherbox.boards.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.boards.application.LibraryService;
import ru.teacherbox.shared.security.CurrentUser;
import tools.jackson.databind.JsonNode;

/** The current user's Excalidraw library — the teacher's or a student's own (the administrator gets 403). */
@RestController
@RequestMapping("/api/boards/library")
class LibraryController {

    private final LibraryService libraries;

    LibraryController(LibraryService libraries) {
        this.libraries = libraries;
    }

    @GetMapping
    JsonNode library(CurrentUser user) {
        return libraries.library(user.id());
    }

    /** The whole library, as Excalidraw's {@code onLibraryChange} gives it. */
    @PutMapping
    JsonNode save(CurrentUser user, @RequestBody JsonNode items) {
        return libraries.save(user.id(), items);
    }
}
