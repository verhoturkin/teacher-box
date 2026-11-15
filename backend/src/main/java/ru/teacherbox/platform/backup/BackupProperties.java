package ru.teacherbox.platform.backup;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Backups of the database and files ({@code TEACHERBOX_BACKUP_*}).
 *
 * @param cron schedule in the instance time zone; {@code -} disables automatic backups
 * @param keepDays how many days a backup is kept: older ones are deleted after a new backup, on the server
 *                 and in Google Drive (which also keeps only {@link Google#keep()} copies); less than one
 *                 keeps a day (the administrator changes it live, ADR-0056)
 * @param restart restoring from the interface ends the application to be started again by the
 *                container ({@code TEACHERBOX_BACKUP_RESTART}, {@code true} in the Docker image)
 * @param google  copies in the teacher's Google Drive (ADR-0037)
 */
@ConfigurationProperties("teacherbox.backup")
public record BackupProperties(
        @DefaultValue("0 30 3 * * *") String cron,
        @DefaultValue("14") int keepDays,
        @DefaultValue("false") boolean restart,
        @DefaultValue Google google) {

    /** How long a backup is kept: at least a day. */
    public Duration retention() {
        return Duration.ofDays(Math.max(keepDays, 1));
    }

    /**
     * Google Drive ({@code TEACHERBOX_BACKUP_GOOGLE_*}); the OAuth client is the teacher's setting, entered in the interface (ADR-0056).
     *
     * @param proxy            proxy for Google ({@code http://host:port} or {@code socks5://host:port})
     * @param authorizationUrl Google's consent page
     * @param oauthUrl         base address of the token and revoke endpoints
     * @param apiUrl           base address of the Drive API
     * @param uploadUrl        base address of the Drive uploads
     * @param keep             how many of the newest copies the Drive folder keeps
     *                         ({@code TEACHERBOX_BACKUP_GOOGLE_KEEP}, ADR-0037): a shorter retention
     *                         than on the server, to save the teacher's Drive quota; {@link #keepDays()}
     *                         still applies; less than one keeps one (live, ADR-0056)
     */
    public record Google(
            @Nullable String proxy,
            @DefaultValue("https://accounts.google.com/o/oauth2/v2/auth") String authorizationUrl,
            @DefaultValue("https://oauth2.googleapis.com") String oauthUrl,
            @DefaultValue("https://www.googleapis.com/drive/v3") String apiUrl,
            @DefaultValue("https://www.googleapis.com/upload/drive/v3") String uploadUrl,
            @DefaultValue("3") int keep) {

        /** How many copies the Drive keeps: at least one. */
        public int kept() {
            return Math.max(keep, 1);
        }
    }
}
