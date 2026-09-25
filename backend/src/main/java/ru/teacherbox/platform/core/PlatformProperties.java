package ru.teacherbox.platform.core;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Instance-wide settings.
 *
 * @param dataDir root directory for all persistent data: database, files, keys, backups
 *                ({@code TEACHERBOX_DATA_DIR}, {@code /data} in Docker)
 */
@ConfigurationProperties("teacherbox")
public record PlatformProperties(@DefaultValue("./data") Path dataDir) {
}
