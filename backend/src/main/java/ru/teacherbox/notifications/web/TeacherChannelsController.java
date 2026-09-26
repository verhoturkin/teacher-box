package ru.teacherbox.notifications.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.ChannelSettingsService;
import ru.teacherbox.notifications.application.ChannelSettingsService.ChannelSetup;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.security.CurrentUser;

/** The teacher sets up the messenger bots; tokens are written, never read back. */
@RestController
@RequestMapping("/api/teacher/notifications/channels")
class TeacherChannelsController {

    /** @param groupId VK community id */
    record BotRequest(@NotBlank @Size(max = 500) String token, @Positive @Nullable Long groupId) {
    }

    private final ChannelSettingsService settings;

    TeacherChannelsController(ChannelSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    List<ChannelSetup> setups() {
        return settings.setups();
    }

    /** Checks the token with the messenger and starts the bot. */
    @PutMapping("/{channel}")
    ChannelSetup save(@PathVariable ChannelType channel, @Valid @RequestBody BotRequest request) {
        return settings.save(channel, request.token(), request.groupId());
    }

    @DeleteMapping("/{channel}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable ChannelType channel) {
        settings.remove(channel);
    }

    /** Sends a test message to the teacher's own account in the messenger. */
    @PostMapping("/{channel}/test")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void test(CurrentUser user, @PathVariable ChannelType channel) {
        settings.test(channel, user.id());
    }
}
