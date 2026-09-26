package ru.teacherbox.notifications.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.ChannelService;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.application.PreferencesService;
import ru.teacherbox.notifications.application.NotificationViews.ChannelView;
import ru.teacherbox.notifications.application.NotificationViews.LinkCodeView;
import ru.teacherbox.notifications.application.NotificationViews.NotificationPage;
import ru.teacherbox.notifications.application.NotificationViews.PreferencesView;
import ru.teacherbox.notifications.application.NotificationViews.UnreadCount;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.NotificationTopic;
import ru.teacherbox.shared.security.CurrentUser;

/** The current user's notifications and messenger settings (teacher and students alike). */
@RestController
@RequestMapping("/api/me")
class MyNotificationsController {

    record ChannelSettingsRequest(@NotNull Boolean enabled) {
    }

    /** @param quietFrom and {@code quietTo}: both or none (no quiet hours) */
    record PreferencesRequest(@NotNull List<NotificationTopic> mutedTopics, @Nullable LocalTime quietFrom,
            @Nullable LocalTime quietTo) {
    }

    private final NotificationService notifications;
    private final ChannelService channels;
    private final PreferencesService preferences;

    MyNotificationsController(NotificationService notifications, ChannelService channels,
            PreferencesService preferences) {
        this.notifications = notifications;
        this.channels = channels;
        this.preferences = preferences;
    }

    @GetMapping("/notifications/preferences")
    PreferencesView preferences(CurrentUser user) {
        return preferences.get(user.id());
    }

    @PutMapping("/notifications/preferences")
    PreferencesView savePreferences(CurrentUser user, @Valid @RequestBody PreferencesRequest request) {
        return preferences.save(user.id(), request.mutedTopics(), request.quietFrom(), request.quietTo());
    }

    @GetMapping("/notifications")
    NotificationPage list(CurrentUser user, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return notifications.page(user.id(), page, size);
    }

    @GetMapping("/notifications/unread-count")
    UnreadCount unreadCount(CurrentUser user) {
        return new UnreadCount(notifications.unreadCount(user.id()));
    }

    @PostMapping("/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markRead(CurrentUser user, @PathVariable UUID id) {
        notifications.markRead(user.id(), id);
    }

    @PostMapping("/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markAllRead(CurrentUser user) {
        notifications.markAllRead(user.id());
    }

    @GetMapping("/channels")
    List<ChannelView> channels(CurrentUser user) {
        return channels.channels(user.id());
    }

    @PostMapping("/channels/{channel}/link-code")
    @ResponseStatus(HttpStatus.CREATED)
    LinkCodeView linkCode(CurrentUser user, @PathVariable ChannelType channel) {
        return channels.createLinkCode(user.id(), channel);
    }

    @PutMapping("/channels/{channel}")
    ChannelView update(CurrentUser user, @PathVariable ChannelType channel,
            @Valid @RequestBody ChannelSettingsRequest request) {
        return channels.setEnabled(user.id(), channel, request.enabled());
    }

    @DeleteMapping("/channels/{channel}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unlink(CurrentUser user, @PathVariable ChannelType channel) {
        channels.unlink(user.id(), channel);
    }
}
