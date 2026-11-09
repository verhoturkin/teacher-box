package ru.teacherbox.platform.settings;

import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.ConfigurableEnvironment;
import ru.teacherbox.platform.backup.BackupProperties;
import ru.teacherbox.platform.backup.PlatformBackupAutoConfiguration;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/** The settings of the portal in the administrator's interface (ADR-0016), live ones without a restart (ADR-0056). */
@AutoConfiguration(after = PlatformBackupAutoConfiguration.class)
public class PlatformSettingsAutoConfiguration {

    @Bean
    AdminSettingsService adminSettingsService(PlatformProperties platform,
            ObjectProvider<PasswordConfirmation> passwords, Restarter restarter, BackupProperties backups,
            ConfigurableEnvironment environment, ApplicationEventPublisher events, Clock clock) {
        return new AdminSettingsService(new SettingsFile(platform.dataDir()), System::getenv,
                values -> AdminSettingsLoader.replace(environment, values), events::publishEvent, passwords,
                restarter, backups.restart(), clock.instant());
    }

    /** The teacher's old values once, while the beans are created (ADR-0056). */
    @Bean
    EnvImport envImport(PlatformProperties platform, ObjectProvider<TeacherSettingsImport> imports, Clock clock) {
        return new EnvImport(platform.dataDir(), new SettingsFile(platform.dataDir()), System::getenv, imports,
                clock);
    }
}
