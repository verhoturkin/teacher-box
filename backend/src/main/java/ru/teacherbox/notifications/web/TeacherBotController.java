package ru.teacherbox.notifications.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.ChatSettingsService;
import ru.teacherbox.notifications.application.ChatSettingsService.BotView;

/** What the bots can do; the teacher switches managing the portal through the bot on and off. */
@RestController
@RequestMapping("/api/teacher/notifications/bot")
class TeacherBotController {

    record BotRequest(boolean teacherActions) {
    }

    private final ChatSettingsService settings;

    TeacherBotController(ChatSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    BotView bot() {
        return settings.view();
    }

    @PutMapping
    BotView change(@RequestBody BotRequest request) {
        return settings.setTeacherActions(request.teacherActions());
    }
}
