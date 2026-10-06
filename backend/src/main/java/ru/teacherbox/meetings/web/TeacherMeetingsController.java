package ru.teacherbox.meetings.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.meetings.application.RoomService;
import ru.teacherbox.meetings.application.RoomService.RoomView;
import ru.teacherbox.meetings.domain.MeetingLinks;
import ru.teacherbox.meetings.domain.RoomOwner;
import ru.teacherbox.shared.error.BusinessRuleException;

/** External call links of students and groups; {@code /api/teacher/**} requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/meetings")
class TeacherMeetingsController {

    /** A link the teacher entered for a student or a group: exactly one of the ids. */
    record LinkRequest(@Nullable UUID studentId, @Nullable UUID groupId,
            @NotBlank @Size(max = MeetingLinks.MAX_LENGTH) String joinUrl) {
    }

    record ShareResponse(int recipients) {
    }

    private final RoomService rooms;

    TeacherMeetingsController(RoomService rooms) {
        this.rooms = rooms;
    }

    @GetMapping("/rooms")
    List<RoomView> rooms() {
        return rooms.list();
    }

    @PutMapping("/rooms")
    RoomView enter(@Valid @RequestBody LinkRequest request) {
        return owner(request.studentId(), request.groupId(), (type, id) -> rooms.enter(type, id, request.joinUrl()));
    }

    @DeleteMapping("/rooms/{ownerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID ownerId) {
        rooms.remove(ownerId);
    }

    @PostMapping("/rooms/{ownerId}/share")
    ShareResponse share(@PathVariable UUID ownerId) {
        return new ShareResponse(rooms.share(ownerId));
    }

    private interface OwnerAction {
        RoomView apply(RoomOwner type, UUID id);
    }

    private static RoomView owner(@Nullable UUID studentId, @Nullable UUID groupId, OwnerAction action) {
        if (studentId != null && groupId == null) {
            return action.apply(RoomOwner.STUDENT, studentId);
        }
        if (groupId != null && studentId == null) {
            return action.apply(RoomOwner.GROUP, groupId);
        }
        throw new BusinessRuleException("meetings.owner-invalid", "Choose either a student or a group");
    }
}
