package ru.teacherbox.platform.settings.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.settings.AdminSettingsService;
import ru.teacherbox.platform.settings.AdminSettingsService.Changed;
import ru.teacherbox.platform.settings.AdminSettingsService.SettingsView;
import ru.teacherbox.shared.security.CurrentUser;

/** The administrator's settings of the portal (ADR-0016): {@code /api/admin/**} is for the administrator only. */
@RestController
@RequestMapping("/api/admin/settings")
class AdminSettingsController {

    /**
     * @param values the new values by variable name; {@code null}: back to {@code .env}
     */
    record ChangeRequest(@NotBlank String password, @NotNull Map<String, @Nullable String> values) {
    }

    private final AdminSettingsService settings;

    AdminSettingsController(AdminSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    SettingsView settings() {
        return settings.view();
    }

    @PutMapping
    Changed change(CurrentUser user, @Valid @RequestBody ChangeRequest request) {
        return settings.change(user.id(), request.password(), request.values());
    }
}
