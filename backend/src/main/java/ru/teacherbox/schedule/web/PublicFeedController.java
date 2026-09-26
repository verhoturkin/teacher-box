package ru.teacherbox.schedule.web;

import java.nio.charset.StandardCharsets;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.application.FeedService;

/**
 * Calendar feed by a secret link, without signing in: calendar applications fetch it themselves.
 * An unknown or disabled link gets 404.
 */
@RestController
class PublicFeedController {

    static final MediaType CALENDAR = new MediaType("text", "calendar", StandardCharsets.UTF_8);

    private final FeedService feeds;

    PublicFeedController(FeedService feeds) {
        this.feeds = feeds;
    }

    @GetMapping(FeedService.PATH + "{token}.ics")
    ResponseEntity<String> calendar(@PathVariable String token) {
        return feeds.calendar(token)
                .map(body -> ResponseEntity.ok()
                        .contentType(CALENDAR)
                        .cacheControl(CacheControl.noStore())
                        .body(body))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
