package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.notifications.FakeMessengerChannel;
import ru.teacherbox.notifications.application.NotificationViews.Connection;
import ru.teacherbox.notifications.application.NotificationViews.MessengerStatus;
import ru.teacherbox.notifications.domain.ChannelType;

class MessengerPollingTest {

    private final ChannelService channelService = mock(ChannelService.class);
    private final MessengerHealth health = new MessengerHealth(
            Clock.fixed(Instant.parse("2026-09-26T10:00:00Z"), ZoneOffset.UTC));

    @Test
    void repliesToEveryIncomingMessage() {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        telegram.receive(new IncomingMessage("1", "@a", "/start ABCD2345"));
        telegram.receive(new IncomingMessage("2", null, "привет"));
        when(channelService.handleIncoming(any(), any())).thenReturn("ответ");
        MessengerPolling polling = new MessengerPolling(channels(telegram), channelService, health);

        assertThat(polling.pollOnce(telegram)).isEqualTo(2);

        assertThat(telegram.sent()).containsExactly(new FakeMessengerChannel.Sent("1", "ответ"),
                new FakeMessengerChannel.Sent("2", "ответ"));
        assertThat(polling.pollOnce(telegram)).isZero();
    }

    @Test
    void failedReplyDoesNotStopPolling() {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        telegram.receive(new IncomingMessage("1", null, "/stop"));
        telegram.failWith(new DeliveryException("blocked", true));
        when(channelService.handleIncoming(any(), any())).thenReturn("ответ");

        assertThat(new MessengerPolling(channels(telegram), channelService, health).pollOnce(telegram)).isEqualTo(1);
    }

    @Test
    void pollsInBackgroundAndSurvivesErrors() {
        AtomicInteger polls = new AtomicInteger();
        FakeMessengerChannel replies = new FakeMessengerChannel(ChannelType.MAX);
        MessengerChannel flaky = new MessengerChannel() {
            @Override
            public ChannelType type() {
                return ChannelType.MAX;
            }

            @Override
            public Optional<String> chatLink(String code) {
                return Optional.empty();
            }

            @Override
            public void send(String externalId, String text) {
                replies.send(externalId, text);
            }

            @Override
            public String botName() {
                return "bot";
            }

            @Override
            public List<IncomingMessage> poll() {
                if (polls.incrementAndGet() == 1) {
                    throw new IllegalStateException("network is down");
                }
                if (polls.get() == 2) {
                    return List.of(new IncomingMessage("9", null, "код"));
                }
                try {
                    Thread.sleep(20);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return List.of();
            }
        };
        when(channelService.handleIncoming(any(), any())).thenReturn("ответ");
        MessengerPolling polling = new MessengerPolling(channels(flaky), channelService, health);

        polling.start();
        try {
            assertThat(polling.isRunning()).isTrue();
            await().atMost(Duration.ofSeconds(10)).until(() -> !replies.sent().isEmpty());
        } finally {
            polling.stop();
        }

        assertThat(polling.isRunning()).isFalse();
        assertThat(replies.sent()).containsExactly(new FakeMessengerChannel.Sent("9", "ответ"));
        assertThat(health.status(ChannelType.MAX).connection()).as("recovered after the first error")
                .isEqualTo(Connection.OK);
    }

    @Test
    void unreachableMessengerIsReported() {
        MessengerChannel blocked = new MessengerChannel() {
            @Override
            public ChannelType type() {
                return ChannelType.TELEGRAM;
            }

            @Override
            public Optional<String> chatLink(String code) {
                return Optional.empty();
            }

            @Override
            public void send(String externalId, String text) {
                throw new DeliveryException("unreachable", false);
            }

            @Override
            public String botName() {
                return "bot";
            }

            @Override
            public List<IncomingMessage> poll() {
                throw new IllegalStateException("Telegram getUpdates: Connection refused");
            }
        };
        MessengerPolling polling = new MessengerPolling(channels(blocked), channelService, health);

        polling.start();
        try {
            await().atMost(Duration.ofSeconds(10))
                    .until(() -> health.status(ChannelType.TELEGRAM).connection() == Connection.ERROR);
        } finally {
            polling.stop();
        }

        MessengerStatus status = health.status(ChannelType.TELEGRAM);
        assertThat(status.error()).isEqualTo("Telegram getUpdates: Connection refused");
        assertThat(status.checkedAt()).isEqualTo(Instant.parse("2026-09-26T10:00:00Z"));
    }

    @Test
    void healthStartsPendingAndReportsRecovery() {
        assertThat(health.status(ChannelType.VK))
                .isEqualTo(new MessengerStatus(ChannelType.VK, Connection.PENDING, null, null));
        assertThat(health.succeeded(ChannelType.VK)).as("first success").isTrue();
        assertThat(health.succeeded(ChannelType.VK)).isFalse();
        health.failed(ChannelType.VK, "timeout");
        assertThat(health.status(ChannelType.VK).connection()).isEqualTo(Connection.ERROR);
        assertThat(health.succeeded(ChannelType.VK)).as("recovered").isTrue();
        assertThat(health.status(ChannelType.VK).error()).isNull();
    }

    @Test
    void restartsPollingWithTheNewAdapter() {
        MessengerChannels registry = channels();
        FakeMessengerChannel first = new FakeMessengerChannel(ChannelType.TELEGRAM);
        registry.put(first);
        when(channelService.handleIncoming(any(), any())).thenReturn("ответ");
        MessengerPolling polling = new MessengerPolling(registry, channelService, health);
        polling.restart(ChannelType.TELEGRAM);
        assertThat(polling.isRunning()).as("restarting before start does nothing").isFalse();

        polling.start();
        try {
            FakeMessengerChannel second = new FakeMessengerChannel(ChannelType.TELEGRAM);
            second.receive(new IncomingMessage("5", null, "код"));
            registry.put(second);
            polling.restart(ChannelType.TELEGRAM);
            polling.restart(ChannelType.VK);

            await().atMost(Duration.ofSeconds(10)).until(() -> !second.sent().isEmpty());
            registry.remove(ChannelType.TELEGRAM);
            polling.restart(ChannelType.TELEGRAM);
        } finally {
            polling.stop();
        }
        assertThat(first.sent()).isEmpty();
    }

    @Test
    void backoffDoublesUpToAMinute() {
        assertThat(MessengerPolling.nextBackoff(Duration.ofSeconds(1))).isEqualTo(Duration.ofSeconds(2));
        assertThat(MessengerPolling.nextBackoff(Duration.ofSeconds(40))).isEqualTo(Duration.ofMinutes(1));
    }

    @Test
    void registryRejectsTwoAdaptersForOneMessenger() {
        assertThatThrownBy(() -> channels(new FakeMessengerChannel(ChannelType.VK),
                new FakeMessengerChannel(ChannelType.VK)))
                .isInstanceOf(IllegalStateException.class);
        MessengerChannels registry = channels(new FakeMessengerChannel(ChannelType.VK));
        assertThat(registry.available()).containsExactly(ChannelType.VK);
        assertThat(registry.isAvailable(ChannelType.TELEGRAM)).isFalse();
        assertThat(registry.find(ChannelType.VK)).isPresent();

        FakeMessengerChannel configured = new FakeMessengerChannel(ChannelType.VK);
        registry.put(configured);
        registry.put(new FakeMessengerChannel(ChannelType.MAX));
        assertThat(registry.find(ChannelType.VK)).as("a configured bot replaces the bean").containsSame(configured);
        assertThat(registry.all()).hasSize(2);
        registry.remove(ChannelType.VK);
        assertThat(registry.find(ChannelType.VK)).as("the bean is used again").isPresent().get()
                .isNotSameAs(configured);
    }

    private static MessengerChannels channels(MessengerChannel... channels) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        for (int i = 0; i < channels.length; i++) {
            beans.addBean("channel" + i, channels[i]);
        }
        return new MessengerChannels(beans.getBeanProvider(MessengerChannel.class));
    }
}
