package ru.teacherbox.platform.admin;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggerConfiguration;
import org.springframework.boot.logging.LoggingSystem;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Log levels changed at runtime for a while (ADR-0010): after the chosen time the previous level comes back,
 * so that a forgotten {@code DEBUG} does not fill the disk.
 */
public class LogLevels implements DisposableBean {

    /** Loggers shown even when nobody changed them. */
    static final List<String> KNOWN = List.of("ROOT", "ru.teacherbox", "ru.teacherbox.identity",
            "ru.teacherbox.billing", "ru.teacherbox.homework", "ru.teacherbox.schedule",
            "ru.teacherbox.notifications", "ru.teacherbox.ai", "ru.teacherbox.platform", "org.springframework");
    static final Duration MAX_DURATION = Duration.ofHours(24);

    private static final Pattern NAME = Pattern.compile("ROOT|[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)*");

    /**
     * @param configuredLevel set explicitly for this logger ({@code null}: inherited)
     * @param effectiveLevel  the level in force
     * @param revertAt        when a temporary level ends
     */
    public record LoggerLevel(String name, @Nullable String configuredLevel, String effectiveLevel,
            @Nullable Instant revertAt) {
    }

    private record Change(@Nullable LogLevel previous, Instant revertAt, ScheduledFuture<?> task) {
    }

    private final LoggingSystem logging;
    private final Clock clock;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "log-level-revert");
        thread.setDaemon(true);
        return thread;
    });
    private final Map<String, Change> changes = new ConcurrentHashMap<>();

    public LogLevels(LoggingSystem logging, Clock clock) {
        this.logging = logging;
        this.clock = clock;
    }

    public List<LoggerLevel> levels() {
        List<String> names = new ArrayList<>(KNOWN);
        changes.keySet().stream().filter(name -> !names.contains(name)).sorted().forEach(names::add);
        return names.stream().map(this::level).toList();
    }

    /**
     * Sets a level for the given time; the previous level returns afterwards.
     *
     * @throws BusinessRuleException for an invalid logger name or duration
     */
    public LoggerLevel change(String name, LogLevel level, Duration duration) {
        if (!NAME.matcher(name).matches()) {
            throw new BusinessRuleException("admin.logger-invalid", "Invalid logger name");
        }
        if (duration.isNegative() || duration.isZero() || duration.compareTo(MAX_DURATION) > 0) {
            throw new BusinessRuleException("admin.duration-invalid", "Duration must be up to 24 hours");
        }
        Change previous = changes.remove(name);
        LogLevel original = previous != null ? previous.previous() : configured(name);
        if (previous != null) {
            previous.task().cancel(false);
        }
        logging.setLogLevel(name, level);
        ScheduledFuture<?> task = scheduler.schedule(() -> revert(name), duration.toMillis(), TimeUnit.MILLISECONDS);
        changes.put(name, new Change(original, clock.instant().plus(duration), task));
        return level(name);
    }

    /** Returns the level the logger had before the change. */
    public LoggerLevel revert(String name) {
        Change change = changes.remove(name);
        if (change != null) {
            change.task().cancel(false);
            logging.setLogLevel(name, change.previous());
        }
        return level(name);
    }

    @Override
    public void destroy() {
        scheduler.shutdownNow();
    }

    private @Nullable LogLevel configured(String name) {
        LoggerConfiguration configuration = logging.getLoggerConfiguration(name);
        return configuration == null ? null : configuration.getConfiguredLevel();
    }

    private LoggerLevel level(String name) {
        LoggerConfiguration configuration = logging.getLoggerConfiguration(name);
        Change change = changes.get(name);
        LogLevel configured = configuration == null ? null : configuration.getConfiguredLevel();
        LogLevel effective = configuration == null ? null : configuration.getEffectiveLevel();
        return new LoggerLevel(name, configured == null ? null : configured.name(),
                effective == null ? "INFO" : effective.name(), change == null ? null : change.revertAt());
    }
}
