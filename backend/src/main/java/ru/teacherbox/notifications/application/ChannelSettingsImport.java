package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository.ChannelSettings;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * The bot tokens from {@code .env} once (ADR-0056), each unless the teacher entered a bot of that messenger.
 * The bot name is not known yet: the bot reports it when it starts. VK needs the community too, as before.
 */
@Component
public class ChannelSettingsImport implements TeacherSettingsImport {

    static final String TELEGRAM_TOKEN = "TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN";
    static final String VK_TOKEN = "TEACHERBOX_NOTIFICATIONS_VK_TOKEN";
    static final String VK_GROUP_ID = "TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID";
    static final String MAX_TOKEN = "TEACHERBOX_NOTIFICATIONS_MAX_TOKEN";

    private final ChannelSettingsRepository settings;
    private final Clock clock;

    public ChannelSettingsImport(ChannelSettingsRepository settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
    }

    @Override
    public Set<String> names() {
        return Set.of(TELEGRAM_TOKEN, VK_TOKEN, VK_GROUP_ID, MAX_TOKEN);
    }

    @Override
    public Set<String> importFrom(OldSettings values) {
        Set<String> stored = new TreeSet<>();
        if (store(ChannelType.TELEGRAM, values.text(TELEGRAM_TOKEN), null)) {
            stored.add(TELEGRAM_TOKEN);
        }
        Optional<Long> group = values.value(VK_GROUP_ID, Long.class);
        if (group.isPresent() && store(ChannelType.VK, values.text(VK_TOKEN), group.get())) {
            stored.add(VK_TOKEN);
            stored.add(VK_GROUP_ID);
        }
        if (store(ChannelType.MAX, values.text(MAX_TOKEN), null)) {
            stored.add(MAX_TOKEN);
        }
        return stored;
    }

    private boolean store(ChannelType channel, Optional<String> token, @Nullable Long groupId) {
        if (token.isEmpty() || settings.find(channel).isPresent()) {
            return false;
        }
        settings.save(new ChannelSettings(channel, token.get(), groupId, null, clock.instant()));
        return true;
    }
}
