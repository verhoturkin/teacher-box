package ru.teacherbox.meetings.web;

import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.meetings.application.CallService;
import ru.teacherbox.meetings.application.CallService.JoinView;
import ru.teacherbox.shared.security.CurrentUser;

/** Joining a built-in call: the teacher and students ({@code /api/meetings/**}), not the administrator. */
@RestController
class CallsController {

    private final CallService calls;

    CallsController(CallService calls) {
        this.calls = calls;
    }

    @PostMapping("/api/meetings/calls/{ownerId}/token")
    JoinView join(@PathVariable UUID ownerId, CurrentUser user) {
        return calls.join(user, ownerId);
    }
}
