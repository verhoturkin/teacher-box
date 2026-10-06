package ru.teacherbox.meetings.application;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.meetings.domain.CallRooms;
import ru.teacherbox.meetings.domain.RoomOwner;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.security.CurrentUser;

/** Built-in calls (ADR-0030): joining the room of a current student or an active group. */
@Service
public class CallService {

    /** A student's own room as the student sees it. */
    static final String OWN_ROOM_TITLE = "Урок";

    /**
     * Everything the browser needs to join.
     *
     * @param title what the call window shows: the student or the group (the group or «Урок» for a student)
     */
    public record JoinView(String token, String room, String title) {
    }

    /** A room the user may enter. */
    record Owner(RoomOwner type, UUID id, String name) {
    }

    private final CallServer server;
    private final UserDirectory users;
    private final StudentGroups groups;

    public CallService(CallServer server, UserDirectory users, StudentGroups groups) {
        this.server = server;
        this.users = users;
        this.groups = groups;
    }

    /** No transaction: nothing is stored, the token is signed locally. */
    public JoinView join(CurrentUser user, UUID ownerId) {
        if (!server.enabled()) {
            throw new BusinessRuleException("meetings.calls-disabled", "Built-in calls are not set up");
        }
        Owner owner = accessible(user, ownerId).orElseThrow(CallService::roomNotFound);
        String room = CallRooms.name(owner.id());
        String title = user.isTeacher() || owner.type() == RoomOwner.GROUP ? owner.name() : OWN_ROOM_TITLE;
        String token = server.token(new CallServer.Grant(room, user.id().toString(), user.displayName(),
                user.isTeacher()));
        return new JoinView(token, room, title);
    }

    /** The room of a current student or an active group that the user may enter. */
    Optional<Owner> accessible(CurrentUser user, UUID ownerId) {
        Optional<Owner> student = users.findStudent(ownerId).filter(StudentSummary::isCurrent)
                .map(found -> new Owner(RoomOwner.STUDENT, found.id(), found.displayName()));
        if (student.isPresent()) {
            return student.filter(found -> user.isTeacher() || found.id().equals(user.id()));
        }
        return groups.findGroup(ownerId).filter(group -> !group.archived())
                .filter(group -> user.isTeacher() || isCurrentMember(user.id(), group))
                .map(group -> new Owner(RoomOwner.GROUP, group.id(), group.name()));
    }

    private boolean isCurrentMember(UUID studentId, GroupSummary group) {
        return group.memberIds().contains(studentId) && users.isCurrentStudent(studentId);
    }

    private static NotFoundException roomNotFound() {
        return new NotFoundException("meetings.room-not-found", "The room does not exist");
    }
}
