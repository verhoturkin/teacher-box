package ru.teacherbox.platform.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;
import ru.teacherbox.platform.admin.LogLevels.LoggerLevel;
import ru.teacherbox.shared.error.BusinessRuleException;

class LogLevelsTest {

    private static final String LOGGER = "ru.teacherbox.test.levels";
    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    private final LoggingSystem logging = LoggingSystem.get(getClass().getClassLoader());
    private final LogLevels levels = new LogLevels(logging, Clock.fixed(NOW, ZoneOffset.UTC));

    @AfterEach
    void cleanUp() {
        logging.setLogLevel(LOGGER, null);
        levels.destroy();
    }

    @Test
    void listsTheKnownLoggers() {
        assertThat(levels.levels()).extracting(LoggerLevel::name).contains("ROOT", "ru.teacherbox.notifications");
    }

    @Test
    void changesALevelForAWhileAndRevertsIt() {
        LoggerLevel changed = levels.change(LOGGER, LogLevel.DEBUG, Duration.ofMinutes(30));

        assertThat(changed.configuredLevel()).isEqualTo("DEBUG");
        assertThat(changed.effectiveLevel()).isEqualTo("DEBUG");
        assertThat(changed.revertAt()).isEqualTo(NOW.plus(Duration.ofMinutes(30)));
        assertThat(levels.levels()).extracting(LoggerLevel::name).contains(LOGGER);

        levels.change(LOGGER, LogLevel.TRACE, Duration.ofMinutes(5));
        LoggerLevel reverted = levels.revert(LOGGER);

        assertThat(reverted.configuredLevel()).isNull();
        assertThat(reverted.revertAt()).isNull();
        assertThat(levels.revert(LOGGER).configuredLevel()).isNull();
    }

    @Test
    void revertsByItself() {
        logging.setLogLevel(LOGGER, LogLevel.WARN);

        levels.change(LOGGER, LogLevel.DEBUG, Duration.ofMillis(50));

        await().atMost(Duration.ofSeconds(5)).until(() ->
                "WARN".equals(levels.levels().stream().filter(level -> level.name().equals(LOGGER)).findFirst()
                        .map(LoggerLevel::configuredLevel).orElse("WARN")));
        assertThat(logging.getLoggerConfiguration(LOGGER).getConfiguredLevel()).isEqualTo(LogLevel.WARN);
    }

    @Test
    void rejectsInvalidRequests() {
        assertThatThrownBy(() -> levels.change("bad name!", LogLevel.DEBUG, Duration.ofMinutes(1)))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("admin.logger-invalid"));
        assertThatThrownBy(() -> levels.change(LOGGER, LogLevel.DEBUG, Duration.ofDays(2)))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("admin.duration-invalid"));
        assertThatThrownBy(() -> levels.change(LOGGER, LogLevel.DEBUG, Duration.ZERO))
                .isInstanceOf(BusinessRuleException.class);
    }
}
