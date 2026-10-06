package ru.teacherbox.meetings.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class CallRoomsTest {

    @Test
    void namesRoomsByTheirOwner() {
        UUID owner = UUID.randomUUID();

        assertThat(CallRooms.name(owner)).isEqualTo("tb-" + owner);
        assertThat(CallRooms.owner(CallRooms.name(owner))).contains(owner);
        assertThat(CallRooms.owner("tb-x")).isEmpty();
        assertThat(CallRooms.owner(owner.toString())).isEmpty();
    }
}
