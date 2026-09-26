package ru.teacherbox.testing;

import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import ru.teacherbox.meetings.api.MeetingRooms;

/** In-memory {@link MeetingRooms} for module tests that do not bootstrap the meetings module. */
public final class FakeMeetingRooms implements MeetingRooms {

    private final Map<UUID, String> rooms = new ConcurrentHashMap<>();

    public void put(UUID ownerId, String joinUrl) {
        rooms.put(ownerId, joinUrl);
    }

    @Override
    public Map<UUID, String> links(Collection<UUID> ownerIds) {
        return ownerIds.stream().distinct().filter(rooms::containsKey)
                .collect(Collectors.toMap(id -> id, id -> Objects.requireNonNull(rooms.get(id))));
    }
}
