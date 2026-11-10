package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.notifications.FakeMessengerChannel;
import ru.teacherbox.notifications.application.MessengerChannelFactory.Credentials;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository.ChannelSettings;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.settings.SettingsChanged;

class ChannelSettingsServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-01T10:00:00Z"), ZoneOffset.UTC);

    private final MessengerChannelFactory telegram = mock(MessengerChannelFactory.class);
    private final MessengerChannelFactory max = mock(MessengerChannelFactory.class);
    private final ChannelSettingsRepository settings = mock(ChannelSettingsRepository.class);
    private final ChannelLinkRepository links = mock(ChannelLinkRepository.class);
    private final UserDirectory users = mock(UserDirectory.class);
    private final MessengerPolling polling = mock(MessengerPolling.class);
    private final MessengerChannels channels = new MessengerChannels(
            new StaticListableBeanFactory().getBeanProvider(MessengerChannel.class));
    private final ChannelSettingsService service;

    ChannelSettingsServiceTest() {
        when(telegram.type()).thenReturn(ChannelType.TELEGRAM);
        when(max.type()).thenReturn(ChannelType.MAX);
        when(telegram.settings()).thenReturn(Set.of("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY",
                "TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL"));
        when(max.settings()).thenReturn(Set.of());
        when(telegram.create(any())).thenReturn(new FakeMessengerChannel(ChannelType.TELEGRAM));
        when(max.create(any())).thenReturn(new FakeMessengerChannel(ChannelType.MAX));
        when(users.teacherId()).thenReturn(UUID.randomUUID());
        when(users.language(any())).thenReturn(Language.RU);
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("polling", polling);
        ObjectProvider<MessengerPolling> pollingProvider = beans.getBeanProvider(MessengerPolling.class);
        service = new ChannelSettingsService(List.of(telegram, max), settings, channels,
                new MessengerHealth(CLOCK), pollingProvider, links, users, CLOCK);
    }

    @Test
    void startsOnlyTheBotsOfTheSettings() {
        when(settings.find(ChannelType.TELEGRAM)).thenReturn(Optional.empty());
        when(settings.find(ChannelType.MAX)).thenReturn(Optional.of(
                new ChannelSettings(ChannelType.MAX, "db-token", null, "@max_bot", CLOCK.instant())));

        service.afterSingletonsInstantiated();

        assertThat(channels.available()).containsExactly(ChannelType.MAX);
        verify(max).create(new Credentials("db-token", null));
        verify(telegram, never()).create(any());
        assertThat(service.setups()).filteredOn(setup -> setup.channel() == ChannelType.TELEGRAM)
                .singleElement()
                .satisfies(setup -> assertThat(setup.configured()).isFalse());
    }

    @Test
    void aFullResetStopsEveryBot() {
        channels.put(new FakeMessengerChannel(ChannelType.TELEGRAM));
        channels.put(new FakeMessengerChannel(ChannelType.MAX));

        service.stopConfigured();

        assertThat(channels.available()).isEmpty();
        verify(polling).restart(ChannelType.TELEGRAM);
        verify(polling).restart(ChannelType.MAX);
    }

    @Test
    void aChangedAddressOrProxyStartsTheBotAnew() {
        when(settings.find(ChannelType.TELEGRAM)).thenReturn(Optional.of(
                new ChannelSettings(ChannelType.TELEGRAM, "db-token", null, "@school_bot", CLOCK.instant())));
        when(settings.find(ChannelType.MAX)).thenReturn(Optional.of(
                new ChannelSettings(ChannelType.MAX, "max-token", null, "@max_bot", CLOCK.instant())));

        service.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS")));
        verify(telegram, never()).create(any());
        verify(max, never()).create(any());

        service.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY")));
        verify(telegram).create(new Credentials("db-token", null));
        verify(max, never()).create(any());
        verify(polling).restart(ChannelType.TELEGRAM);
        assertThat(channels.isAvailable(ChannelType.TELEGRAM)).isTrue();

        // a proxy the bot cannot start with stops it; the token stays saved
        when(telegram.create(any())).thenThrow(new IllegalStateException("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY: bad"));
        service.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL")));
        assertThat(channels.isAvailable(ChannelType.TELEGRAM)).isFalse();
        verify(settings, never()).delete(any());

        // no bot saved: nothing to start
        when(settings.find(ChannelType.TELEGRAM)).thenReturn(Optional.empty());
        service.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY")));
        verify(telegram, times(2)).create(any());
    }

    @Test
    void theTeacherRemovesABot() {
        channels.put(new FakeMessengerChannel(ChannelType.TELEGRAM));

        service.remove(ChannelType.TELEGRAM);

        verify(settings).delete(ChannelType.TELEGRAM);
        assertThat(channels.isAvailable(ChannelType.TELEGRAM)).isFalse();
        assertThatThrownBy(() -> service.remove(ChannelType.VK)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void aSavedBotReplacesThePreviousOneAndRestartsPolling() {
        when(settings.find(ChannelType.MAX)).thenReturn(Optional.empty());

        service.save(ChannelType.MAX, " token ", null);

        verify(settings).save(new ChannelSettings(ChannelType.MAX, "token", null, "@test_bot", CLOCK.instant()));
        verify(polling).restart(ChannelType.MAX);
        assertThat(channels.isAvailable(ChannelType.MAX)).isTrue();
    }

    @Test
    void unsupportedMessengersAreReported() {
        assertThatThrownBy(() -> service.save(ChannelType.VK, "token", 1L))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("notifications.channel-unavailable"));
    }

    @Test
    void aFailedTestMessageIsExplained() {
        FakeMessengerChannel channel = new FakeMessengerChannel(ChannelType.MAX);
        channel.failWith(new DeliveryException("MAX 403: chat not found", true));
        channels.put(channel);
        UUID teacher = UUID.randomUUID();
        when(links.find(teacher, ChannelType.MAX)).thenReturn(Optional.of(
                new ChannelLink(UUID.randomUUID(), teacher, ChannelType.MAX, "7", null, true, CLOCK.instant())));

        assertThatThrownBy(() -> service.test(ChannelType.MAX, teacher))
                .isInstanceOfSatisfying(BusinessRuleException.class, e -> {
                    assertThat(e.code()).isEqualTo("notifications.test-failed");
                    assertThat(e.getMessage()).isEqualTo("MAX 403: chat not found");
                });
    }
}
