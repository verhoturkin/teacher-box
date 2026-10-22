package ru.teacherbox.boards.web;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.time.Duration;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.boards.application.PreviewService;
import ru.teacherbox.shared.security.CurrentUser;

/** The preview picture of a board: the teacher's editor uploads it on save, the board's readers get it. */
@RestController
class BoardPreviewController {

    private final PreviewService previews;

    BoardPreviewController(PreviewService previews) {
        this.previews = previews;
    }

    /** The PNG as the request body; {@code /api/teacher/**} requires the teacher role. */
    @PutMapping("/api/teacher/boards/{id}/preview")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void upload(@PathVariable UUID id,
            @RequestHeader(name = HttpHeaders.CONTENT_TYPE, required = false) @Nullable String contentType,
            HttpServletRequest request) throws IOException {
        previews.save(id, contentType == null ? "" : contentType, Math.max(request.getContentLengthLong(), 0),
                request.getInputStream());
    }

    @DeleteMapping("/api/teacher/boards/{id}/preview")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void clear(@PathVariable UUID id) {
        previews.clear(id);
    }

    /** The browser asks again after a minute (the editor replaces it on every save). */
    @GetMapping("/api/boards/{id}/preview")
    ResponseEntity<Resource> read(CurrentUser user, @PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(1)).cachePrivate())
                .body(previews.read(user, id));
    }
}
