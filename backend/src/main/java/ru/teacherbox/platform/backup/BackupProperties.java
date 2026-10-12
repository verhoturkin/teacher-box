package ru.teacherbox.platform.backup;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Backups of the database and files ({@code TEACHERBOX_BACKUP_*}).
 *
 * @param cron schedule in the instance time zone; {@code -} disables automatic backups
 * @param keep    how many scheduled and manual backups to keep (older ones are deleted after a new
 *                backup), on the server and in Google Drive
 * @param restart restoring from the interface ends the application to be started again by the
 *                container ({@code TEACHERBOX_BACKUP_RESTART}, {@code true} in the Docker image)
 * @param google  copies in the teacher's Google Drive (ADR-0037)
 */
@ConfigurationProperties("teacherbox.backup")
public record BackupProperties(
        @DefaultValue("0 30 3 * * *") String cron,
        @DefaultValue("7") int keep,
        @DefaultValue("false") boolean restart,
        @DefaultValue Google google) {

    public BackupProperties {
        if (keep < 1) {
            throw new IllegalArgumentException("teacherbox.backup.keep must be at least 1");
        }
    }

    /**
     * Google Drive ({@code TEACHERBOX_BACKUP_GOOGLE_*}).
     *
     * @param clientId         OAuth client; takes precedence over the one entered in the interface
     * @param clientSecret     its secret
     * @param proxy            proxy for Google ({@code http://host:port} or {@code socks5://host:port})
     * @param authorizationUrl Google's consent page
     * @param oauthUrl         base address of the token and revoke endpoints
     * @param apiUrl           base address of the Drive API
     * @param uploadUrl        base address of the Drive uploads
     */
    public record Google(
            @Nullable String clientId,
            @Nullable String clientSecret,
            @Nullable String proxy,
            @DefaultValue("https://accounts.google.com/o/oauth2/v2/auth") String authorizationUrl,
            @DefaultValue("https://oauth2.googleapis.com") String oauthUrl,
            @DefaultValue("https://www.googleapis.com/drive/v3") String apiUrl,
            @DefaultValue("https://www.googleapis.com/upload/drive/v3") String uploadUrl) {

        /** Both client settings come from the environment. */
        public boolean clientFromEnvironment() {
            return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
        }
    }
}
