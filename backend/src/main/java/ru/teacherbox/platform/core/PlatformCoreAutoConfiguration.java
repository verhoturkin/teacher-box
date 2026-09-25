package ru.teacherbox.platform.core;

import java.time.Clock;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

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
}
