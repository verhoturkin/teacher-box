package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.notifications.FakeMessengerChannel;
import ru.teacherbox.notifications.application.NotificationViews.Connection;
import ru.teacherbox.notifications.application.NotificationViews.MessengerStatus;
import ru.teacherbox.notifications.domain.ChannelType;

class MessengerPollingTest {

    private final ChatEngine engine = mock(ChatEngine.class);
    private final MessengerHealth health = new MessengerHealth(
            Clock.fixed(Instant.parse("2026-09-26T10:00:00Z"), ZoneOffset.UTC));

    @Test
    void repliesToEveryIncomingMessage() {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        telegram.receive(new IncomingMessage("1", "@a", "/start ABCD2345"));
        telegram.receive(new IncomingMessage("2", null, "привет"));
        when(engine.handle(any(), any())).thenReturn(OutgoingMessage.text("ответ"));
        MessengerPolling polling = new MessengerPolling(channels(telegram), engine, health);

        assertThat(polling.pollOnce(telegram)).isEqualTo(2);

        assertThat(telegram.sent()).containsExactly(new FakeMessengerChannel.Sent("1", "ответ"),
                new FakeMessengerChannel.Sent("2", "ответ"));
        assertThat(polling.pollOnce(telegram)).isZero();
    }

    @Test
    void acknowledgesPressedButtons() {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        ButtonPress press = new ButtonPress("abcdefghijkl:0", "cb-1", "15", null);
        telegram.receive(new IncomingMessage("1", null, "", press));
        when(engine.handle(any(), any())).thenReturn(OutgoingMessage.text("ответ"));

        assertThat(new MessengerPolling(channels(telegram), engine, health).pollOnce(telegram)).isEqualTo(1);

        assertThat(telegram.acknowledged()).containsExactly(press);
        assertThat(telegram.sent()).containsExactly(new FakeMessengerChannel.Sent("1", "ответ"));
    }

    @Test
    void failedAcknowledgementAndCommandsDoNotStopPolling() {
        MessengerChannel stubborn = mock(MessengerChannel.class);
        when(stubborn.type()).thenReturn(ChannelType.MAX);
        ButtonPress press = new ButtonPress("abcdefghijkl:0", "cb-1", null, "Меню");
        when(stubborn.poll()).thenReturn(List.of(new IncomingMessage("7", null, "", press)));
        doThrow(new IllegalStateException("MAX /answers 500")).when(stubborn)
                .acknowledge(any(), any());
        doThrow(new IllegalStateException("no commands")).when(stubborn).publishCommands(any());
        when(engine.handle(any(), any())).thenReturn(OutgoingMessage.text("ответ"));

        MessengerPolling.publishCommands(stubborn);
        assertThat(new MessengerPolling(channels(stubborn), engine, health).pollOnce(stubborn)).isEqualTo(1);

        verify(stubborn).send("7", OutgoingMessage.text("ответ"));
    }

    @Test
    void failedReplyDoesNotStopPolling() {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        telegram.receive(new IncomingMessage("1", null, "/stop"));
        telegram.failWith(new DeliveryException("blocked", true));
        when(engine.handle(any(), any())).thenReturn(OutgoingMessage.text("ответ"));

        assertThat(new MessengerPolling(channels(telegram), engine, health).pollOnce(telegram)).isEqualTo(1);
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
            public void send(String externalId, OutgoingMessage message) {
                replies.send(externalId, message);
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
        when(engine.handle(any(), any())).thenReturn(OutgoingMessage.text("ответ"));
        MessengerPolling polling = new MessengerPolling(channels(flaky), engine, health);

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
            public void send(String externalId, OutgoingMessage message) {
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
        MessengerPolling polling = new MessengerPolling(channels(blocked), engine, health);

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
    void neverInterruptsTheAnswersThatWorkWithTheDatabase() throws InterruptedException {
        FakeMessengerChannel telegram = new FakeMessengerChannel(ChannelType.TELEGRAM);
        telegram.receive(new IncomingMessage("7", null, "код"));
        CountDownLatch answering = new CountDownLatch(1);
        CountDownLatch stopped = new CountDownLatch(1);
        AtomicBoolean interrupted = new AtomicBoolean();
        when(engine.handle(any(), any())).thenAnswer(invocation -> {
            answering.countDown();
            stopped.await(10, TimeUnit.SECONDS);
            // H2 closes the whole database when a thread is interrupted during its file I/O
            interrupted.set(Thread.currentThread().isInterrupted());
            return OutgoingMessage.text("ответ");
        });
        MessengerPolling polling = new MessengerPolling(channels(telegram), engine, health);

        polling.start();
        assertThat(answering.await(10, TimeUnit.SECONDS)).isTrue();
        polling.restart(ChannelType.TELEGRAM);
        polling.stop();
        stopped.countDown();

        await().atMost(Duration.ofSeconds(10)).until(() -> !telegram.sent().isEmpty());
        assertThat(interrupted).isFalse();
    }

    @Test
    void stopsAThreadThatWaitsForTheMessengerAtOnce() {
        AtomicReference<Thread> waiting = new AtomicReference<>();
        MessengerChannel slow = new MessengerChannel() {
            @Override
            public ChannelType type() {
                return ChannelType.VK;
            }

            @Override
            public Optional<String> chatLink(String code) {
                return Optional.empty();
            }

            @Override
            public void send(String externalId, OutgoingMessage message) {
            }

            @Override
            public String botName() {
                return "bot";
            }

            @Override
            public List<IncomingMessage> poll() {
                waiting.set(Thread.currentThread());
                try {
                    Thread.sleep(Duration.ofMinutes(1));
                } catch (InterruptedException e) {
                    throw new IllegalStateException("interrupted", e);
                }
                return List.of();
            }
        };
        MessengerPolling polling = new MessengerPolling(channels(slow), engine, health);

        polling.start();
        await().atMost(Duration.ofSeconds(10)).until(() -> waiting.get() != null);
        polling.stop();

        await().atMost(Duration.ofSeconds(5)).until(() -> !waiting.get().isAlive());
        assertThat(health.status(ChannelType.VK).connection()).as("a stop is not a failure")
                .isEqualTo(Connection.PENDING);
    }

    @Test
    void restartsPollingWithTheNewAdapter() {
        MessengerChannels registry = channels();
        FakeMessengerChannel first = new FakeMessengerChannel(ChannelType.TELEGRAM);
        registry.put(first);
        when(engine.handle(any(), any())).thenReturn(OutgoingMessage.text("ответ"));
        MessengerPolling polling = new MessengerPolling(registry, engine, health);
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
