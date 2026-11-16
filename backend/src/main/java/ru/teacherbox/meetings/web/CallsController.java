package ru.teacherbox.meetings.web;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.meetings.application.CallService;
import ru.teacherbox.meetings.application.CallService.CallsView;
import ru.teacherbox.meetings.application.CallService.JoinView;
import ru.teacherbox.meetings.application.CallService.MyCallView;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;

/** Built-in calls: the rooms with who is in them and joining one; never the administrator. */
@RestController
class CallsController {

    private final CallService calls;

    CallsController(CallService calls) {
        this.calls = calls;
    }

    /** {@code /api/teacher/**} requires the teacher role. */
    @GetMapping("/api/teacher/meetings/calls")
    CallsView rooms() {
        return calls.rooms();
    }

    @GetMapping("/api/me/meetings/calls")
    List<MyCallView> myRooms(CurrentUser user) {
        if (user.role() != Role.STUDENT) {
            throw new ForbiddenException("meetings.students-only", "Only students have rooms");
        }
        return calls.studentRooms(user.id());
    }

    @PostMapping("/api/meetings/calls/{ownerId}/token")
    JoinView join(@PathVariable UUID ownerId, CurrentUser user) {
        return calls.join(user, ownerId);
    }

    @PostMapping("/api/teacher/meetings/calls/{ownerId}/participants/{userId}/mute")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void mute(@PathVariable UUID ownerId, @PathVariable UUID userId) {
        calls.mute(ownerId, userId);
    }

    @DeleteMapping("/api/teacher/meetings/calls/{ownerId}/participants/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID ownerId, @PathVariable UUID userId) {
        calls.remove(ownerId, userId);
    }
}
