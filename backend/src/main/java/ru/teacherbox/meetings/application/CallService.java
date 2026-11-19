package ru.teacherbox.meetings.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.meetings.api.CallSummoned;
import ru.teacherbox.meetings.domain.CallRooms;
import ru.teacherbox.meetings.domain.Room;
import ru.teacherbox.meetings.domain.RoomOwner;
import ru.teacherbox.meetings.persistence.RoomRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.shared.security.CurrentUser;

/** Built-in calls (ADR-0030): joining the room of a current student or an active group. */
@Service
public class CallService {


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
     * @param avatar       address of the student's photo; {@code null}: none, or a group
     */
    public record CallCard(UUID ownerId, RoomOwner ownerType, String name, int members, List<String> waiting,
            boolean teacherPresent, boolean externalLink, @Nullable String avatar) {

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

    /** A student is called once per this pause, whoever presses «Позвать». */
    static final Duration SUMMON_PAUSE = Duration.ofMinutes(3);

    private final CallServer server;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final RoomRepository links;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final Portal portal;
    /** shortcut: kept in memory, a restart forgets it — fine for a pause of minutes. */
    private final Map<UUID, Instant> summoned = new ConcurrentHashMap<>();

    public CallService(CallServer server, UserDirectory users, StudentGroups groups, RoomRepository links,
            ApplicationEventPublisher events, TransactionTemplate transactions, Clock clock, Portal portal) {
        this.server = server;
        this.users = users;
        this.groups = groups;
        this.links = links;
        this.events = events;
        this.transactions = transactions;
        this.clock = clock;
        this.portal = portal;
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
            cards.add(card(RoomOwner.STUDENT, student.id(), student.displayName(), student.avatar(), 1, occupied,
                    teacher, external));
        }
        for (GroupSummary group : groups.currentGroups()) {
            cards.add(card(RoomOwner.GROUP, group.id(), group.name(), null, group.memberIds().size(), occupied,
                    teacher, external));
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
        rooms.add(new MyCallView(studentId, RoomOwner.STUDENT, ownRoomTitle(), present(occupied, studentId, teacher)));
        for (GroupSummary group : groups.groupsOf(studentId)) {
            rooms.add(new MyCallView(group.id(), RoomOwner.GROUP, group.name(),
                    present(occupied, group.id(), teacher)));
        }
        return rooms;
    }

    /** No transaction: nothing is stored, the token is signed locally. */
    public JoinView join(CurrentUser user, UUID ownerId) {
        requireEnabled();
        Owner owner = accessible(user, ownerId).orElseThrow(CallService::roomNotFound);
        String room = CallRooms.name(owner.id());
        String title = user.isTeacher() || owner.type() == RoomOwner.GROUP ? owner.name() : ownRoomTitle();
        String token = server.token(new CallServer.Grant(room, user.id().toString(), user.displayName(),
                user.isTeacher()));
        return new JoinView(token, room, title);
    }

    /**
     * «Позвать»: the students of the room who are not in the call get a notice with it; each once per
     * {@link #SUMMON_PAUSE}. The media server is asked outside a transaction, the event is published in one.
     *
     * @return number of students called
     */
    public int summon(UUID ownerId) {
        requireEnabled();
        if (links.findByOwner(ownerId).isPresent()) {
            throw new BusinessRuleException("meetings.room-external", "The lessons take place in an external room");
        }
        Optional<GroupSummary> group = groups.findGroup(ownerId).filter(found -> !found.archived());
        List<UUID> members = group.map(found -> found.memberIds().stream().filter(users::isCurrentStudent).toList())
                .orElseGet(() -> users.findStudent(ownerId).filter(StudentSummary::isCurrent)
                        .map(found -> List.of(found.id())).orElse(List.of()));
        if (members.isEmpty()) {
            throw roomNotFound();
        }
        Set<String> inCall = occupied().orElseThrow(CallService::unreachable)
                .getOrDefault(CallRooms.name(ownerId), List.of()).stream().map(CallServer.Participant::identity)
                .collect(Collectors.toSet());
        List<UUID> absent = members.stream().filter(id -> !inCall.contains(id.toString())).toList();
        if (absent.isEmpty()) {
            throw new BusinessRuleException("meetings.everyone-in-call", "Everyone is in the call");
        }
        Instant now = clock.instant();
        List<UUID> called = absent.stream().filter(id -> {
            Instant last = summoned.get(id);
            return last == null || !now.isBefore(last.plus(SUMMON_PAUSE));
        }).toList();
        if (called.isEmpty()) {
            throw new BusinessRuleException("meetings.summoned-recently", "The students were called a moment ago");
        }
        called.forEach(id -> summoned.put(id, now));
        String joinUrl = portal.link(RoomService.CALL_PATH + ownerId).orElse(null);
        transactions.executeWithoutResult(status -> events.publishEvent(
                new CallSummoned(ownerId, group.map(GroupSummary::id).orElse(null), called, joinUrl, now)));
        return called.size();
    }

    /** The teacher mutes the microphone of a participant; a user not in the room is no error. */
    public void mute(UUID ownerId, UUID userId) {
        moderate(ownerId, userId, server::muteMicrophone);
    }

    /** The teacher removes a participant; they may join again while the room is open to them. */
    public void remove(UUID ownerId, UUID userId) {
        moderate(ownerId, userId, server::removeParticipant);
    }

    private void moderate(UUID ownerId, UUID userId, BiConsumer<String, String> action) {
        requireEnabled();
        try {
            action.accept(CallRooms.name(ownerId), userId.toString());
        } catch (CallServerException e) {
            log.warn("The media server did not answer: {}", e.getMessage());
            throw unreachable();
        }
    }

    private static BusinessRuleException unreachable() {
        return new BusinessRuleException("meetings.call-server-unreachable", "The media server did not answer");
    }

    private void requireEnabled() {
        if (!server.enabled()) {
            throw new BusinessRuleException("meetings.calls-disabled", "Built-in calls are not set up");
        }
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

    private static CallCard card(RoomOwner type, UUID ownerId, String name, @Nullable String avatar, int members,
            Map<String, List<CallServer.Participant>> occupied, String teacher, Set<UUID> external) {
        List<CallServer.Participant> inRoom = occupied.getOrDefault(CallRooms.name(ownerId), List.of());
        List<String> waiting = inRoom.stream().filter(participant -> !participant.identity().equals(teacher))
                .map(CallServer.Participant::name).toList();
        return new CallCard(ownerId, type, name, members, waiting, inRoom.size() > waiting.size(),
                external.contains(ownerId), avatar);
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

    /** A student's own room as the student sees it, in the language of the page (ADR-0036). */
    static String ownRoomTitle() {
        return switch (Language.current()) {
            case RU -> "Урок";
            case EN -> "Lesson";
        };
    }
}
