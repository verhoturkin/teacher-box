package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SettingKindTest {

    private static boolean fits(SettingKind kind, String value) {
        return kind.problem(value, List.of("anthropic", "gemini")) == null;
    }

    @Test
    void anEmptyValueAlwaysFits() {
        for (SettingKind kind : SettingKind.values()) {
            assertThat(fits(kind, "")).as(kind.name()).isTrue();
        }
    }

    @Test
    void checksTheValuesByKind() {
        assertThat(fits(SettingKind.TEXT, "что угодно")).isTrue();
        assertThat(fits(SettingKind.NUMBER, "30")).isTrue();
        assertThat(fits(SettingKind.NUMBER, "-1")).isFalse();
        assertThat(fits(SettingKind.BOOLEAN, "true")).isTrue();
        assertThat(fits(SettingKind.BOOLEAN, "да")).isFalse();
        assertThat(fits(SettingKind.DURATION, "15m")).isTrue();
        assertThat(fits(SettingKind.DURATION, "PT15M")).isTrue();
        assertThat(fits(SettingKind.DURATION, "15 минут")).isFalse();
        assertThat(fits(SettingKind.DURATIONS, "24h, 1h")).isTrue();
        assertThat(fits(SettingKind.DURATIONS, "24h,час")).isFalse();
        assertThat(fits(SettingKind.DATA_SIZE, "20MB")).isTrue();
        assertThat(fits(SettingKind.DATA_SIZE, "много")).isFalse();
        assertThat(fits(SettingKind.CRON, "0 30 3 * * *")).isTrue();
        assertThat(fits(SettingKind.CRON, "-")).isTrue();
        assertThat(fits(SettingKind.CRON, "30 3 * * *")).isFalse();
        assertThat(fits(SettingKind.ADDRESS, "https://school.example.com")).isTrue();
        assertThat(fits(SettingKind.ADDRESS, "https://school.example.com/")).isTrue();
        assertThat(fits(SettingKind.ADDRESS, "https://school.example.com/app")).isFalse();
        assertThat(fits(SettingKind.ADDRESS, "school.example.com")).isFalse();
        assertThat(fits(SettingKind.URL, "https://api.openai.com/v1")).isTrue();
        assertThat(fits(SettingKind.URL, "ftp://host")).isFalse();
        assertThat(fits(SettingKind.URL, "http://bad host")).isFalse();
        assertThat(fits(SettingKind.PROXY, "socks5://host.docker.internal:1080")).isTrue();
        assertThat(fits(SettingKind.PROXY, "socks5://host")).isFalse();
        assertThat(fits(SettingKind.PROXY, "https://host:1080")).isFalse();
        assertThat(fits(SettingKind.PROXY, "::")).isFalse();
        assertThat(fits(SettingKind.TIME_ZONE, "Europe/Moscow")).isTrue();
        assertThat(fits(SettingKind.TIME_ZONE, "Moscow")).isFalse();
        assertThat(fits(SettingKind.CURRENCY, "RUB")).isTrue();
        assertThat(fits(SettingKind.CURRENCY, "RUR1")).isFalse();
        assertThat(fits(SettingKind.CHOICE, "gemini")).isTrue();
        assertThat(fits(SettingKind.CHOICE, "openai")).isFalse();
        assertThat(SettingKind.CHOICE.problem("openai", List.of("anthropic", "gemini")))
                .isEqualTo("нужно одно из значений: anthropic, gemini");
    }
}
