package ru.teacherbox.platform.core;

import java.time.Clock;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * Core infrastructure shared by all modules. Registered as auto-configuration so that it is also
 * available in isolated module tests ({@code @ApplicationModuleTest}).
 */
@AutoConfiguration
@EnableConfigurationProperties(PlatformProperties.class)
public class PlatformCoreAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    @ConditionalOnMissingBean
    InstanceTimeZone instanceTimeZone(PlatformProperties properties) {
        return new InstanceTimeZone(properties.timezone());
    }

    /** Background jobs of the modules ({@code @Scheduled}); switched off in tests. */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnBooleanProperty(name = "teacherbox.scheduling.enabled", matchIfMissing = true)
    @EnableScheduling
    static class SchedulingConfiguration {
    }
}
