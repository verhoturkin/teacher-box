package ru.teacherbox.boards.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.boards.application.LiveTickets;
import ru.teacherbox.boards.application.SceneService;
import ru.teacherbox.boards.application.SceneService.BoardContent;
import ru.teacherbox.boards.application.SceneService.FileDownload;
import ru.teacherbox.boards.application.SceneService.SceneView;
import ru.teacherbox.shared.security.CurrentUser;
import tools.jackson.databind.JsonNode;

/**
 * A board in the editor, for the teacher and the board's students (ADR-0028); others get 404. The
 * scene is saved with a merge per element and polled for the changes of the others.
 */
@RestController
@RequestMapping("/api/boards/{id}")
class BoardsController {

    /** @param baseVersion the scene version the editor had */
    record SaveRequest(@NotNull JsonNode elements, @Nullable JsonNode appState, @NotNull Long baseVersion) {
    }

    /** A one-time ticket to the board's live channel ({@code /api/public/boards/live?ticket=}). */
    record LiveTicket(String ticket) {
    }

    private final SceneService scenes;
    private final LiveTickets tickets;

    BoardsController(SceneService scenes, LiveTickets tickets) {
        this.scenes = scenes;
        this.tickets = tickets;
    }

    @GetMapping
    BoardContent open(CurrentUser user, @PathVariable UUID id) {
        return scenes.open(user, id);
    }

    /** The editor opens the live channel with it (ADR-0029); valid once, for a minute. */
    @PostMapping("/live")
    LiveTicket live(CurrentUser user, @PathVariable UUID id) {
        return new LiveTicket(tickets.issue(user, id));
    }

    @PutMapping("/scene")
    SceneView save(CurrentUser user, @PathVariable UUID id, @Valid @RequestBody SaveRequest request) {
        return scenes.save(user, id, request.elements(), request.appState(), request.baseVersion());
    }

    /** 204 while the scene is still at {@code since}. */
    @GetMapping("/scene")
    ResponseEntity<SceneView> changes(CurrentUser user, @PathVariable UUID id, @RequestParam long since) {
        return scenes.changesSince(user, id, since)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** The image as the request body, its type in {@code Content-Type}; stored once per file id. */
    @PutMapping("/files/{fileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void upload(CurrentUser user, @PathVariable UUID id, @PathVariable String fileId,
            @RequestHeader(name = HttpHeaders.CONTENT_TYPE, required = false) @Nullable String contentType,
            HttpServletRequest request) throws IOException {
        scenes.upload(user, id, fileId, contentType, Math.max(request.getContentLengthLong(), 0),
                request.getInputStream());
    }

    /** An image never changes under its id: the browser keeps it for a year. */
    @GetMapping("/files/{fileId}")
    ResponseEntity<Resource> download(CurrentUser user, @PathVariable UUID id, @PathVariable String fileId) {
        FileDownload file = scenes.download(user, id, fileId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.file().contentType()))
                .contentLength(file.file().size())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable())
                .body(file.content());
    }
}
