package ru.teacherbox.homework.web;

import java.nio.charset.StandardCharsets;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.homework.application.InteractivePages;

/**
 * The page of interactive homework by its signed link (ADR-0040). Its own policy replaces the portal's: a sandbox
 * with scripts but no origin, nothing loaded from anywhere, shown only in a frame of the portal.
 */
@RestController
class InteractivePageController {

    static final String CONTENT_SECURITY_POLICY = "sandbox allow-scripts; default-src 'none'; "
            + "script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; "
            + "media-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

    private final InteractivePages pages;

    InteractivePageController(InteractivePages pages) {
        this.pages = pages;
    }

    @GetMapping(InteractivePages.PATH + "{token}")
    ResponseEntity<String> page(@PathVariable String token) {
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .cacheControl(CacheControl.noStore())
                .header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
                .header("X-Frame-Options", "SAMEORIGIN")
                .header("Referrer-Policy", "no-referrer")
                .header("X-Content-Type-Options", "nosniff")
                .body(pages.page(token));
    }
}
