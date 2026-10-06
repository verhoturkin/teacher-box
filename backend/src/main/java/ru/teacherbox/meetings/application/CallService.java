package ru.teacherbox.meetings.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.meetings.domain.CallRooms;
import ru.teacherbox.meetings.domain.Room;
import ru.teacherbox.meetings.domain.RoomOwner;
import ru.teacherbox.meetings.persistence.RoomRepository;
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

    /** Whether the occupancy of the rooms is known. */
    public enum CallsStatus {
        OK,
        /** The media server did not answer: the rooms are listed without who is in them. */
        UNREACHABLE,
        /** Built-in calls are not set up. */
        OFF
    }

    /**
     * The built-in room of a current student or an active group, for the teacher.
     *
     * @param members      students of the group (1 for a student)
     * @param waiting      names of the students in the room
     * @param externalLink an external link wins over the room in lessons
     */
    public record CallCard(UUID ownerId, RoomOwner ownerType, String name, int members, List<String> waiting,
            boolean teacherPresent, boolean externalLink) {

        public CallCard {
            waiting = List.copyOf(waiting);
        }
    }

    public record CallsView(CallsStatus status, List<CallCard> rooms) {

        public CallsView {
            rooms = List.copyOf(rooms);
        }
    }

    /** The own room of a student or the room of their group. */
    public record MyCallView(UUID ownerId, RoomOwner ownerType, String title, boolean teacherPresent) {
    }

    private static final Logger log = LoggerFactory.getLogger(CallService.class);

    private final CallServer server;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final RoomRepository links;

    public CallService(CallServer server, UserDirectory users, StudentGroups groups, RoomRepository links) {
        this.server = server;
        this.users = users;
        this.groups = groups;
        this.links = links;
    }

    /** Every room with who is in it; no transaction around the call to the media server. */
    public CallsView rooms() {
        String teacher = users.teacherId().toString();
        Set<UUID> external = links.findAll().stream().map(Room::ownerId).collect(Collectors.toSet());
        Map<String, List<CallServer.Participant>> occupied = Map.of();
        CallsStatus status = CallsStatus.OFF;
        if (server.enabled()) {
            Optional<Map<String, List<CallServer.Participant>>> found = occupied();
            status = found.isPresent() ? CallsStatus.OK : CallsStatus.UNREACHABLE;
            occupied = found.orElse(Map.of());
        }
        List<CallCard> cards = new ArrayList<>();
        List<StudentSummary> students = users.currentStudents().stream()
                .sorted(Comparator.comparing(StudentSummary::displayName, String.CASE_INSENSITIVE_ORDER)).toList();
        for (StudentSummary student : students) {
            cards.add(card(RoomOwner.STUDENT, student.id(), student.displayName(), 1, occupied, teacher, external));
        }
        for (GroupSummary group : groups.currentGroups()) {
            cards.add(card(RoomOwner.GROUP, group.id(), group.name(), group.memberIds().size(), occupied, teacher,
                    external));
        }
        return new CallsView(status, cards);
    }

    /** The own room of the student and the rooms of their active groups; empty while calls are off. */
    public List<MyCallView> studentRooms(UUID studentId) {
        if (!server.enabled() || !users.isCurrentStudent(studentId)) {
            return List.of();
        }
        String teacher = users.teacherId().toString();
        Map<String, List<CallServer.Participant>> occupied = occupied().orElse(Map.of());
        List<MyCallView> rooms = new ArrayList<>();
        rooms.add(new MyCallView(studentId, RoomOwner.STUDENT, OWN_ROOM_TITLE, present(occupied, studentId, teacher)));
        for (GroupSummary group : groups.groupsOf(studentId)) {
            rooms.add(new MyCallView(group.id(), RoomOwner.GROUP, group.name(),
                    present(occupied, group.id(), teacher)));
        }
        return rooms;
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

    private Optional<Map<String, List<CallServer.Participant>>> occupied() {
        try {
            return Optional.of(server.occupiedRooms());
        } catch (CallServerException e) {
            log.warn("The media server did not answer: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static CallCard card(RoomOwner type, UUID ownerId, String name, int members,
            Map<String, List<CallServer.Participant>> occupied, String teacher, Set<UUID> external) {
        List<CallServer.Participant> inRoom = occupied.getOrDefault(CallRooms.name(ownerId), List.of());
        List<String> waiting = inRoom.stream().filter(participant -> !participant.identity().equals(teacher))
                .map(CallServer.Participant::name).toList();
        return new CallCard(ownerId, type, name, members, waiting, inRoom.size() > waiting.size(),
                external.contains(ownerId));
    }

    private static boolean present(Map<String, List<CallServer.Participant>> occupied, UUID ownerId,
            String teacher) {
        return occupied.getOrDefault(CallRooms.name(ownerId), List.of()).stream()
                .anyMatch(participant -> participant.identity().equals(teacher));
    }

    private boolean isCurrentMember(UUID studentId, GroupSummary group) {
        return group.memberIds().contains(studentId) && users.isCurrentStudent(studentId);
    }

    private static NotFoundException roomNotFound() {
        return new NotFoundException("meetings.room-not-found", "The room does not exist");
    }
}
