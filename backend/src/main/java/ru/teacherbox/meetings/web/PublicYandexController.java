package ru.teacherbox.meetings.web;

import java.net.URI;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.meetings.application.YandexService;
import ru.teacherbox.meetings.application.YandexService.AuthorizationResult;

/** Yandex OAuth redirects the teacher's browser here (without a portal token; the state authorizes it). */
@RestController
class PublicYandexController {

    static final String SETTINGS_PAGE = "/teacher/settings";

    private final YandexService yandex;

    PublicYandexController(YandexService yandex) {
        this.yandex = yandex;
    }

    @GetMapping(YandexService.CALLBACK_PATH)
    ResponseEntity<Void> callback(@RequestParam(required = false) @Nullable String state,
            @RequestParam(required = false) @Nullable String code,
            @RequestParam(required = false) @Nullable String error) {
        AuthorizationResult result = yandex.complete(state, code, error);
        URI target = URI.create(SETTINGS_PAGE + "?tab=meetings&yandex=" + result.name().toLowerCase(Locale.ROOT));
        return ResponseEntity.status(302).location(target).build();
    }
}
