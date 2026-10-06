package ru.teacherbox.meetings.application;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.identity.api.StudentDeactivated;
import ru.teacherbox.meetings.domain.CallRooms;

/**
 * Takes users out of built-in calls they may no longer join (ADR-0030): a student who lost access to the
 * portal, students removed from a group, everyone of an archived group. Tokens are short-lived, so this
 * only ends calls that are going on.
 */
@Component
class CallAccess {

    private static final Logger log = LoggerFactory.getLogger(CallAccess.class);

    private final CallServer server;

    CallAccess(CallServer server) {
        this.server = server;
    }

    @ApplicationModuleListener
    void on(StudentDeactivated event) {
        String student = event.studentId().toString();
        remove((room, identity) -> identity.equals(student));
    }

    @ApplicationModuleListener
    void on(GroupChanged event) {
        if (event.removedIds().isEmpty()) {
            return;
        }
        String room = CallRooms.name(event.groupId());
        Set<String> removed = event.removedIds().stream().map(UUID::toString).collect(Collectors.toSet());
        remove((name, identity) -> name.equals(room) && removed.contains(identity));
    }

    @ApplicationModuleListener
    void on(GroupArchived event) {
        String room = CallRooms.name(event.groupId());
        remove((name, identity) -> name.equals(room));
    }

    /** A failure is logged, not retried: the call ends by itself and nobody can join again. */
    private void remove(BiPredicate<String, String> leaving) {
        if (!server.enabled()) {
            return;
        }
        try {
            for (Map.Entry<String, List<CallServer.Participant>> room : server.occupiedRooms().entrySet()) {
                for (CallServer.Participant participant : room.getValue()) {
                    if (leaving.test(room.getKey(), participant.identity())) {
                        server.removeParticipant(room.getKey(), participant.identity());
                        log.info("Removed {} from the call {}", participant.identity(), room.getKey());
                    }
                }
            }
        } catch (CallServerException e) {
            log.warn("Could not remove users from calls: {}", e.getMessage());
        }
    }
}
