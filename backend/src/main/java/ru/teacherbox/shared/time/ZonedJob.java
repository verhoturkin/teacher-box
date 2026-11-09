package ru.teacherbox.shared.time;

import java.util.Locale;
import java.util.Objects;

/**
 * A background job that runs by a cron expression in the instance time zone (SPI, ADR-0056). {@code platform}
 * collects the beans and schedules them; when the time zone or the cron setting changes
 * ({@code SettingsChanged}), the job is scheduled anew, without a restart. Use it instead of
 * {@code @Scheduled(cron = ..., zone = ...)}, which reads the zone once at the start.
 */
public interface ZonedJob {

    /** For the logs, e.g. {@code identity-housekeeping}. */
    String name();

    /** The property holding the cron expression, e.g. {@code teacherbox.backup.cron}; read on every scheduling. */
    String cronProperty();

    /** The cron expression when the property is not set, e.g. {@code 0 30 3 * * *}. */
    String defaultCron();

    void run();

    /** The variable of {@link #cronProperty()}, as {@code SettingsChanged} names it: {@code TEACHERBOX_BACKUP_CRON}. */
    default String cronSetting() {
        return cronProperty().replace('.', '_').replace('-', '_').toUpperCase(Locale.ROOT);
    }

    static ZonedJob of(String name, String cronProperty, String defaultCron, Runnable task) {
        Objects.requireNonNull(task, "task");
        return new ZonedJob() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String cronProperty() {
                return cronProperty;
            }

            @Override
            public String defaultCron() {
                return defaultCron;
            }

            @Override
            public void run() {
                task.run();
            }
        };
    }
}
