package ru.teacherbox.platform.core;

import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.EnableScheduling;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.shared.time.ZonedJob;

/**
 * Core infrastructure shared by all modules. Registered as auto-configuration so that it is also
 * available in isolated module tests ({@code @ApplicationModuleTest}).
 */
@AutoConfiguration(afterName = "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration")
@EnableConfigurationProperties(PlatformProperties.class)
public class PlatformCoreAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    Clock clock() {
        return Clock.systemUTC();
    }

    /** The connection the module migrations run on ({@code ModuleMigrations}); closed when the application stops. */
    @Bean(destroyMethod = "close")
    @ConditionalOnBean(DataSourceProperties.class)
    MigrationConnection migrationConnection(DataSourceProperties properties) {
        return new MigrationConnection(properties.determineUrl(), properties.determineUsername(),
                properties.determinePassword());
    }

    /**
     * Background jobs of the modules: {@code @Scheduled} with fixed delays and the {@link ZonedJob}s by cron in
     * the instance time zone ({@link ZonedJobs}); switched off in tests.
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnBooleanProperty(name = "teacherbox.scheduling.enabled", matchIfMissing = true)
    @EnableScheduling
    static class SchedulingConfiguration {

        @Bean
        ZonedJobs zonedJobs(ObjectProvider<ZonedJob> jobs, ObjectProvider<InstanceTimeZone> timeZone,
                Environment environment) {
            return new ZonedJobs(jobs, timeZone, environment);
        }
    }
}
