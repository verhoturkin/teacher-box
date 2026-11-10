package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.notifications.application.ChannelSettingsImport;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository.ChannelSettings;
import ru.teacherbox.shared.settings.OldSettings;

/** The bot tokens of an upgraded instance come from {@code .env} once (ADR-0056). */
@NotificationsIntegrationTest
class SettingsImportIntegrationTests {

    private static final String TELEGRAM = "TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN";
    private static final String VK = "TEACHERBOX_NOTIFICATIONS_VK_TOKEN";
    private static final String VK_GROUP = "TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID";
    private static final String MAX = "TEACHERBOX_NOTIFICATIONS_MAX_TOKEN";

    @Autowired
    ChannelSettingsImport settingsImport;

    @Autowired
    ChannelSettingsRepository settings;

    @AfterEach
    void noBots() {
        for (ChannelType channel : ChannelType.values()) {
            settings.delete(channel);
        }
    }

    @Test
    void anUpgradedInstanceKeepsItsBotsAndASecondImportChangesNothing() {
        OldSettings old = new OldSettings(Map.of(TELEGRAM, "123:telegram", VK, "vk-token", VK_GROUP, "42",
                MAX, "max-token"));

        assertThat(settingsImport.importFrom(old)).containsExactlyInAnyOrder(TELEGRAM, VK, VK_GROUP, MAX);

        assertThat(settings.find(ChannelType.TELEGRAM)).hasValueSatisfying(saved -> {
            assertThat(saved.token()).isEqualTo("123:telegram");
            assertThat(saved.botName()).isNull();
        });
        assertThat(settings.find(ChannelType.VK)).hasValueSatisfying(saved -> {
            assertThat(saved.token()).isEqualTo("vk-token");
            assertThat(saved.groupId()).isEqualTo(42L);
        });
        assertThat(settings.find(ChannelType.MAX)).hasValueSatisfying(
                saved -> assertThat(saved.token()).isEqualTo("max-token"));

        assertThat(settingsImport.importFrom(new OldSettings(Map.of(TELEGRAM, "456:other")))).isEmpty();
        assertThat(settings.find(ChannelType.TELEGRAM)).hasValueSatisfying(
                saved -> assertThat(saved.token()).isEqualTo("123:telegram"));
    }

    @Test
    void aBotTheTeacherEnteredStaysAndVkNeedsItsCommunity() {
        settings.save(new ChannelSettings(ChannelType.MAX, "own", null, "Свой бот", Instant.now()));

        assertThat(settingsImport.importFrom(new OldSettings(Map.of(MAX, "max-token", VK, "vk-token")))).isEmpty();

        assertThat(settings.find(ChannelType.MAX)).hasValueSatisfying(
                saved -> assertThat(saved.token()).isEqualTo("own"));
        assertThat(settings.find(ChannelType.VK)).isEmpty();
    }
}
