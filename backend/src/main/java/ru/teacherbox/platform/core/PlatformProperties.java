package ru.teacherbox.platform.core;

import java.nio.file.Path;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Instance-wide settings.
 *
 * @param dataDir  root directory for all persistent data: database, files, keys, backups
 *                 ({@code TEACHERBOX_DATA_DIR}, {@code /data} in Docker)
 * @param timezone time zone of the teacher ({@code TEACHERBOX_TIMEZONE})
 */
@ConfigurationProperties("teacherbox")
public record PlatformProperties(
        @DefaultValue("./data") Path dataDir,
        @DefaultValue("Europe/Moscow") ZoneId timezone) {
}
