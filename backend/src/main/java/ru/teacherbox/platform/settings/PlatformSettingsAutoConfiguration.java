package ru.teacherbox.platform.settings;

import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import ru.teacherbox.platform.backup.BackupProperties;
import ru.teacherbox.platform.backup.PlatformBackupAutoConfiguration;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.PasswordConfirmation;

/** The settings of the portal in the administrator's interface (ADR-0016). */
@AutoConfiguration(after = PlatformBackupAutoConfiguration.class)
public class PlatformSettingsAutoConfiguration {

    @Bean
    AdminSettingsService adminSettingsService(PlatformProperties platform,
            ObjectProvider<PasswordConfirmation> passwords, Restarter restarter, BackupProperties backups,
            Clock clock) {
        return new AdminSettingsService(new SettingsFile(platform.dataDir()), System::getenv, passwords, restarter,
                backups.restart(), clock.instant());
    }
}
