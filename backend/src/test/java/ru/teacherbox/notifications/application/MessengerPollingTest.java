package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.notifications.FakeMessengerChannel;
import ru.teacherbox.notifications.domain.ChannelType;

class MessengerPollingTest {

    private final ChannelService channelService = mock(ChannelService.class);

    @Test
    void repliesToEveryIncomingMessage() {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        telegram.receive(new IncomingMessage("1", "@a", "/start ABCD2345"));
        telegram.receive(new IncomingMessage("2", null, "привет"));
        when(channelService.handleIncoming(any(), any())).thenReturn("ответ");
        MessengerPolling polling = new MessengerPolling(channels(telegram), channelService);

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

        assertThat(new MessengerPolling(channels(telegram), channelService).pollOnce(telegram)).isEqualTo(1);
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
        MessengerPolling polling = new MessengerPolling(channels(flaky), channelService);

        polling.start();
        try {
            assertThat(polling.isRunning()).isTrue();
            await().atMost(Duration.ofSeconds(10)).until(() -> !replies.sent().isEmpty());
        } finally {
            polling.stop();
        }

        assertThat(polling.isRunning()).isFalse();
        assertThat(replies.sent()).containsExactly(new FakeMessengerChannel.Sent("9", "ответ"));
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
    }

    private static MessengerChannels channels(MessengerChannel... channels) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        for (int i = 0; i < channels.length; i++) {
            beans.addBean("channel" + i, channels[i]);
        }
        return new MessengerChannels(beans.getBeanProvider(MessengerChannel.class));
    }
}
