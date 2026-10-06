package ru.teacherbox.meetings.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class MeetingDomainTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    @Test
    void acceptsHttpLinksOnly() {
        assertThat(MeetingLinks.valid(" https://telemost.yandex.ru/j/1 ")).isEqualTo("https://telemost.yandex.ru/j/1");
        assertThat(MeetingLinks.valid("http://zoom.us/j/1")).isEqualTo("http://zoom.us/j/1");
        for (String bad : new String[] {null, " ", "ftp://x", "not a link", "https://user@host/x", "https:///x",
                "https://x/" + "a".repeat(1000), "https://exa mple.com"}) {
            assertThatThrownBy(() -> MeetingLinks.valid(bad)).isInstanceOf(BusinessRuleException.class)
                    .hasFieldOrPropertyWithValue("code", "meetings.link-invalid");
        }
    }

    @Test
    void recognizesTelemost() {
        assertThat(MeetingLinks.isTelemost("https://telemost.yandex.ru/j/1")).isTrue();
        assertThat(MeetingLinks.isTelemost("https://telemost.360.yandex.ru/j/1")).isTrue();
        assertThat(MeetingLinks.isTelemost("https://zoom.us/j/1")).isFalse();
        assertThat(MeetingLinks.isTelemost("https://exa mple.com")).isFalse();
    }

    @Test
    void aRoomKeepsItsIdentityWhenItsLinkIsReplaced() {
        UUID owner = UUID.randomUUID();
        Room entered = Room.entered(UUID.randomUUID(), RoomOwner.STUDENT, owner, "https://zoom.us/j/1", NOW);

        Room replaced = entered.withLink("https://telemost.yandex.ru/j/2", NOW.plusSeconds(2));

        assertThat(entered.isTelemost()).isFalse();
        assertThat(replaced.id()).isEqualTo(entered.id());
        assertThat(replaced.isTelemost()).isTrue();
        assertThat(replaced.createdAt()).isEqualTo(NOW);
        assertThat(replaced.updatedAt()).isEqualTo(NOW.plusSeconds(2));
    }
}
