package ru.teacherbox.platform.backup.web;

import java.net.URI;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.backup.drive.CloudBackupService;
import ru.teacherbox.platform.backup.drive.CloudBackupService.AuthorizationResult;

/**
 * Google's OAuth redirect for the Drive of the backups. The browser comes here without the portal's
 * token, so the request is authorized by the one-time {@code state}; the teacher is then sent back to
 * the settings page.
 */
@RestController
class PublicDriveController {

    static final String SETTINGS_PAGE = "/teacher/settings";

    private final CloudBackupService drive;

    PublicDriveController(CloudBackupService drive) {
        this.drive = drive;
    }

    @GetMapping(CloudBackupService.CALLBACK_PATH)
    ResponseEntity<Void> callback(@RequestParam(required = false) @Nullable String state,
            @RequestParam(required = false) @Nullable String code,
            @RequestParam(required = false) @Nullable String error) {
        AuthorizationResult result = drive.complete(state, code, error);
        URI target = URI.create(SETTINGS_PAGE + "?drive=" + result.name().toLowerCase(Locale.ROOT) + "#backups");
        return ResponseEntity.status(302).location(target).build();
    }
}
