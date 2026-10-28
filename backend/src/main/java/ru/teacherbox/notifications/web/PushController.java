package ru.teacherbox.notifications.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.PushSubscriptionService;
import ru.teacherbox.notifications.application.PushSubscriptionService.DeviceView;
import ru.teacherbox.shared.security.CurrentUser;

/** The browsers of the current user that get web push (teacher and students alike, ADR-0051). */
@RestController
@RequestMapping("/api/me/push")
class PushController {

    record PublicKey(String key) {
    }

    /** The subscription as {@code PushSubscription.toJSON()} gives it: {@code endpoint} and {@code keys}. */
    record SubscribeRequest(@NotBlank @Size(max = 1000) String endpoint, @NotNull @Valid Keys keys) {

        record Keys(@NotBlank @Size(max = 200) String p256dh, @NotBlank @Size(max = 100) String auth) {
        }
    }

    private final PushSubscriptionService push;

    PushController(PushSubscriptionService push) {
        this.push = push;
    }

    @GetMapping("/key")
    PublicKey key() {
        return new PublicKey(push.publicKey());
    }

    @GetMapping("/subscriptions")
    List<DeviceView> list(CurrentUser user) {
        return push.devices(user.id());
    }

    @PostMapping("/subscriptions")
    @ResponseStatus(HttpStatus.CREATED)
    DeviceView subscribe(CurrentUser user, @Valid @RequestBody SubscribeRequest request,
            @RequestHeader(value = "User-Agent", required = false) @Nullable String userAgent) {
        return push.subscribe(user.id(), request.endpoint(), request.keys().p256dh(), request.keys().auth(),
                userAgent);
    }

    @DeleteMapping("/subscriptions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unsubscribe(CurrentUser user, @PathVariable UUID id) {
        push.unsubscribe(user.id(), id);
    }
}
