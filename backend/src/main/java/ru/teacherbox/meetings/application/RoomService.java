package ru.teacherbox.meetings.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.meetings.api.MeetingRooms;
import ru.teacherbox.meetings.domain.Room;
import ru.teacherbox.meetings.domain.RoomOwner;
import ru.teacherbox.meetings.persistence.RoomRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** External call links of students and groups (ADR-0030). */
@Service
public class RoomService implements MeetingRooms {

    /**
     * @param ownerName the student's or the group's name
     * @param telemost  the link opens Telemost (and so its desktop application)
     */
    public record RoomView(UUID ownerId, RoomOwner ownerType, @Nullable String ownerName, String joinUrl,
            boolean telemost, Instant updatedAt) {
    }

    /** A student's room or the room of one of their groups. */
    public record MyRoomView(RoomOwner ownerType, @Nullable String groupName, String joinUrl, boolean telemost) {
    }

    private final RoomRepository rooms;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public RoomService(RoomRepository rooms, UserDirectory users, StudentGroups groups,
            ApplicationEventPublisher events, Clock clock) {
        this.rooms = rooms;
        this.users = users;
        this.groups = groups;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RoomView> list() {
        List<Room> all = rooms.findAll();
        Map<UUID, String> names = names(all.stream().map(Room::ownerId).toList());
        return all.stream().map(room -> view(room, names.get(room.ownerId()))).toList();
    }

    /** Stores a link the teacher entered (Telemost or any other video service). */
    @Transactional
    public RoomView enter(RoomOwner ownerType, UUID ownerId, String joinUrl) {
        String name = requireOwner(ownerType, ownerId);
        Instant now = clock.instant();
        Room entered = Room.entered(Ids.newId(), ownerType, ownerId, joinUrl, now);
        Optional<Room> existing = rooms.findByOwner(ownerId);
        if (existing.isPresent()) {
            return view(rooms.update(existing.get().withLink(entered.joinUrl(), now)), name);
        }
        rooms.insert(entered);
        return view(entered, name);
    }

    @Transactional
    public void remove(UUID ownerId) {
        if (!rooms.deleteByOwner(ownerId)) {
            throw roomNotFound();
        }
    }

    /**
     * Sends the link to the student or to the current members of the group.
     *
     * @return number of recipients
     */
    @Transactional
    public int share(UUID ownerId) {
        Room room = rooms.findByOwner(ownerId).orElseThrow(RoomService::roomNotFound);
        List<UUID> recipients = room.ownerType() == RoomOwner.STUDENT
                ? users.findStudent(ownerId).filter(StudentSummary::isCurrent).map(student -> List.of(student.id()))
                        .orElse(List.of())
                : groups.findGroup(ownerId).filter(group -> !group.archived()).map(GroupSummary::memberIds)
                        .orElse(List.of());
        if (recipients.isEmpty()) {
            throw new BusinessRuleException("meetings.no-recipients", "Nobody can get the link");
        }
        events.publishEvent(new MeetingLinkShared(ownerId, room.ownerType() == RoomOwner.GROUP ? ownerId : null,
                recipients, room.joinUrl(), clock.instant()));
        return recipients.size();
    }

    /** The student's own room and the rooms of their current groups. */
    @Transactional(readOnly = true)
    public List<MyRoomView> studentRooms(UUID studentId) {
        List<GroupSummary> own = groups.groupsOf(studentId);
        List<UUID> owners = new ArrayList<>();
        owners.add(studentId);
        own.forEach(group -> owners.add(group.id()));
        Map<UUID, Room> found = rooms.findByOwners(owners).stream()
                .collect(Collectors.toMap(Room::ownerId, Function.identity()));
        List<MyRoomView> result = new ArrayList<>();
        Optional.ofNullable(found.get(studentId))
                .ifPresent(room -> result.add(new MyRoomView(RoomOwner.STUDENT, null, room.joinUrl(), room.isTelemost())));
        for (GroupSummary group : own) {
            Room room = found.get(group.id());
            if (room != null) {
                result.add(new MyRoomView(RoomOwner.GROUP, group.name(), room.joinUrl(), room.isTelemost()));
            }
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> links(Collection<UUID> ownerIds) {
        return rooms.findByOwners(ownerIds.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(Room::ownerId, Room::joinUrl));
    }

    /** @return the owner's name */
    private String requireOwner(RoomOwner ownerType, UUID ownerId) {
        return switch (ownerType) {
            case STUDENT -> users.findStudent(ownerId).filter(StudentSummary::isCurrent)
                    .map(StudentSummary::displayName)
                    .orElseThrow(() -> new NotFoundException("meetings.student-not-found", "Student not found"));
            case GROUP -> groups.findGroup(ownerId).filter(group -> !group.archived())
                    .map(GroupSummary::name)
                    .orElseThrow(() -> new NotFoundException("meetings.group-not-found", "Group not found"));
        };
    }

    private Map<UUID, String> names(Collection<UUID> ownerIds) {
        Map<UUID, String> names = users.findStudents(ownerIds).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName));
        groups.findGroups(ownerIds).forEach(group -> names.put(group.id(), group.name()));
        return names;
    }

    private static RoomView view(Room room, @Nullable String name) {
        return new RoomView(room.ownerId(), room.ownerType(), name, room.joinUrl(), room.isTelemost(), room.updatedAt());
    }

    private static NotFoundException roomNotFound() {
        return new NotFoundException("meetings.room-not-found", "The room does not exist");
    }
}
