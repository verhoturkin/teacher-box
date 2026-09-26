package ru.teacherbox.schedule.web;

import java.net.URI;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.google.GoogleCalendarService;
import ru.teacherbox.schedule.google.GoogleCalendarService.AuthorizationResult;

/**
 * Google's OAuth redirect. The browser comes here without the portal's token, so the request is
 * authorized by the one-time {@code state}; the teacher is then sent back to the settings page.
 */
@RestController
class PublicGoogleController {

    static final String SETTINGS_PAGE = "/teacher/settings";

    private final GoogleCalendarService calendar;

    PublicGoogleController(GoogleCalendarService calendar) {
        this.calendar = calendar;
    }

    @GetMapping(GoogleCalendarService.CALLBACK_PATH)
    ResponseEntity<Void> callback(@RequestParam(required = false) @Nullable String state,
            @RequestParam(required = false) @Nullable String code,
            @RequestParam(required = false) @Nullable String error) {
        AuthorizationResult result = calendar.complete(state, code, error);
        URI target = URI.create(SETTINGS_PAGE + "?google=" + result.name().toLowerCase(Locale.ROOT));
        return ResponseEntity.status(302).location(target).build();
    }
}
