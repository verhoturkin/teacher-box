package ru.teacherbox.shared;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class IdsTest {

    @Test
    void generatesVersion7Variant2Uuids() {
        UUID id = Ids.newId();

        assertThat(id.version()).isEqualTo(7);
        assertThat(id.variant()).isEqualTo(2);
    }

    @Test
    void embedsTimestampInMostSignificantBits() {
        long millis = 1_758_800_000_000L;

        UUID id = Ids.fromParts(millis, -1L, -1L);

        assertThat(id.getMostSignificantBits() >>> 16).isEqualTo(millis);
        assertThat(id.version()).isEqualTo(7);
        assertThat(id.variant()).isEqualTo(2);
    }

    @Test
    void idsAreOrderedByTime() {
        UUID earlier = Ids.fromParts(1_000L, 0, 0);
        UUID later = Ids.fromParts(2_000L, 0, 0);

        assertThat(earlier.toString()).isLessThan(later.toString());
    }

    @Test
    void idsAreUnique() {
        Set<UUID> ids = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            ids.add(Ids.newId());
        }
        assertThat(ids).hasSize(10_000);
    }
}
