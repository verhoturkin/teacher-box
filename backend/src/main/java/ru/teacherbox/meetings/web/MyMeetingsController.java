package ru.teacherbox.meetings.web;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.meetings.application.RoomService;
import ru.teacherbox.meetings.application.RoomService.MyRoomView;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;

/** A student's rooms: their own and those of their groups. */
@RestController
class MyMeetingsController {

    private final RoomService rooms;

    MyMeetingsController(RoomService rooms) {
        this.rooms = rooms;
    }

    @GetMapping("/api/me/meetings/rooms")
    List<MyRoomView> rooms(CurrentUser user) {
        if (user.role() != Role.STUDENT) {
            throw new ForbiddenException("meetings.students-only", "Only students have rooms");
        }
        return rooms.studentRooms(user.id());
    }
}
