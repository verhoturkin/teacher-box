package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.notifications.FakeMessengerChannel;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.IntegrationStatus;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.State;

class MessengerIntegrationCheckTest {

    @Test
    void asksEveryConfiguredBotForItsName() {
        MessengerChannels channels = new MessengerChannels(
                new StaticListableBeanFactory().getBeanProvider(MessengerChannel.class));
        channels.put(new FakeMessengerChannel(ChannelType.TELEGRAM));
        FakeMessengerChannel max = new FakeMessengerChannel(ChannelType.MAX);
        max.failBotName(new IllegalStateException("MAX 401: Invalid access_token"));
        channels.put(max);

        assertThat(new MessengerIntegrationCheck(channels).check()).satisfiesExactly(
                telegram -> {
                    assertThat(telegram.name()).isEqualTo("Telegram");
                    assertThat(telegram.state()).isEqualTo(State.OK);
                    assertThat(telegram.detail()).isEqualTo("Бот @test_bot отвечает");
                },
                vk -> assertThat(vk).extracting(IntegrationStatus::name, IntegrationStatus::state)
                        .containsExactly("ВКонтакте", State.NOT_CONFIGURED),
                failed -> {
                    assertThat(failed.state()).isEqualTo(State.FAILED);
                    assertThat(failed.detail()).isEqualTo("MAX 401: Invalid access_token");
                });
    }
}
