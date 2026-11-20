package ru.teacherbox.notifications.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.GuardianPreferencesService;
import ru.teacherbox.notifications.application.NotificationViews.GuardianPreferencesView;
import ru.teacherbox.notifications.domain.GuardianCategory;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The guardian's choice of the children's notices (ADR-0069). The inbox, messengers and quiet hours are the
 * guardian's own {@code /api/me/notifications/**} and {@code /api/me/channels/**}, as for everyone.
 */
@RestController
@RequestMapping("/api/guardian/notifications")
class GuardianNotificationsController {

    record GuardianPreferencesRequest(@NotNull List<GuardianCategory> disabledCategories) {
    }

    private final GuardianPreferencesService preferences;

    GuardianNotificationsController(GuardianPreferencesService preferences) {
        this.preferences = preferences;
    }

    @GetMapping("/preferences")
    GuardianPreferencesView preferences(CurrentUser user) {
        return preferences.get(user.id());
    }

    @PutMapping("/preferences")
    GuardianPreferencesView save(CurrentUser user, @Valid @RequestBody GuardianPreferencesRequest request) {
        return preferences.save(user.id(), request.disabledCategories());
    }
}
