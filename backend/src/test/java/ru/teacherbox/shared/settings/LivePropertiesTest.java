package ru.teacherbox.shared.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

class LivePropertiesTest {

    @ConfigurationProperties("teacherbox.sample")
    record Sample(@DefaultValue("8") int attempts, @DefaultValue("15m") Duration ttl) {
    }

    @ConfigurationProperties(prefix = "teacherbox.other")
    record Other(@DefaultValue("1") int count) {
    }

    record Plain(int count) {
    }

    @Test
    void bindsTheValuesInForceOnEveryCall() {
        StandardEnvironment environment = new StandardEnvironment();
        Map<String, Object> values = new HashMap<>();
        environment.getPropertySources().addFirst(new MapPropertySource("test", values));
        LiveProperties<Sample> sample = new LiveProperties<>(environment, Sample.class);

        assertThat(sample.get()).isEqualTo(new Sample(8, Duration.ofMinutes(15)));

        values.put("teacherbox.sample.attempts", "3");
        values.put("teacherbox.sample.ttl", "30m");
        assertThat(sample.get()).isEqualTo(new Sample(3, Duration.ofMinutes(30)));

        environment.getPropertySources().addFirst(new MapPropertySource("more", Map.of("teacherbox.other.count", "5")));
        assertThat(new LiveProperties<>(environment, Other.class).get().count()).isEqualTo(5);
    }

    @Test
    void needsConfigurationProperties() {
        assertThatThrownBy(() -> new LiveProperties<>(new StandardEnvironment(), Plain.class))
                .isInstanceOf(NullPointerException.class).hasMessageContaining("Plain");
    }

    @Test
    void anEventTellsWhichSettingsChanged() {
        SettingsChanged changed = new SettingsChanged(Set.of("TEACHERBOX_BACKUP_CRON"));

        assertThat(changed.touches("TEACHERBOX_BACKUP_")).isTrue();
        assertThat(changed.touches("TEACHERBOX_BOARDS_")).isFalse();
    }
}
