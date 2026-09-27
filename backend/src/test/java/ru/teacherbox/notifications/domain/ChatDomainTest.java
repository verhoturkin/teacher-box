package ru.teacherbox.notifications.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.chat.ChatState;

class ChatDomainTest {

    private static final Instant NOW = Instant.parse("2026-09-28T10:00:00Z");

    @Test
    void buttonsCarryOnlyATokenAndAnIndex() {
        String token = ButtonSet.newToken();
        assertThat(token).matches("[A-Za-z0-9]{12}").isNotEqualTo(ButtonSet.newToken());
        ButtonSet set = new ButtonSet(token, UUID.randomUUID(), ChannelType.TELEGRAM, "42", "test.action",
                ChatState.EMPTY, List.of("yes", "no"), NOW, NOW.plus(Duration.ofDays(2)));

        assertThat(set.data(1)).isEqualTo(token + ":1");
        assertThat(ButtonSet.parse(" " + set.data(1) + " ")).contains(new ButtonSet.Press(token, 1));
        assertThat(ButtonSet.parse(token + ":123")).isEmpty();
        assertThat(ButtonSet.parse("short:1")).isEmpty();

        assertThat(set.choice(1, ChannelType.TELEGRAM, "42", NOW)).contains("no");
        assertThat(set.choice(2, ChannelType.TELEGRAM, "42", NOW)).isEmpty();
        assertThat(set.choice(-1, ChannelType.TELEGRAM, "42", NOW)).isEmpty();
        assertThat(set.choice(0, ChannelType.VK, "42", NOW)).isEmpty();
        assertThat(set.choice(0, ChannelType.TELEGRAM, "43", NOW)).isEmpty();
        assertThat(set.choice(0, ChannelType.TELEGRAM, "42", NOW.plus(Duration.ofDays(2)))).isEmpty();
    }

    @Test
    void aDialogWaitsForItsActionUntilItExpires() {
        UUID recipient = UUID.randomUUID();
        ChatDialog idle = ChatDialog.idle(ChannelType.MAX, "7");
        assertThat(idle.waitingAction(NOW)).isEmpty();

        ChatDialog waiting = idle.actingFor(recipient).waitFor("test.action", ChatState.of("step", "date"),
                NOW.plus(Duration.ofMinutes(30)));
        assertThat(waiting.waitingAction(NOW)).contains("test.action");
        assertThat(waiting.waitingAction(NOW.plus(Duration.ofMinutes(30)))).isEmpty();
        assertThat(waiting.recipientId()).isEqualTo(recipient);

        ChatDialog finished = waiting.finished();
        assertThat(finished.waitingAction(NOW)).isEmpty();
        assertThat(finished.state()).isEqualTo(ChatState.EMPTY);
        assertThat(finished.recipientId()).isEqualTo(recipient);
        assertThat(new ChatDialog(ChannelType.MAX, "7", null, "a", ChatState.EMPTY, null).waitingAction(NOW)).isEmpty();
    }
}
