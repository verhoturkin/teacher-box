package ru.teacherbox.platform.admin;

import java.nio.file.Path;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.health.actuate.endpoint.HealthEndpoint;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.modulith.events.core.EventPublicationRegistry;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import tools.jackson.databind.json.JsonMapper;

/** The administrator's tools (ADR-0010); the REST API is in {@code platform.admin.web}. */
@AutoConfiguration(after = PlatformCoreAutoConfiguration.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class PlatformAdminAutoConfiguration {

    @Bean
    LogFiles logFiles(ConfigurableEnvironment environment) {
        String file = environment.getProperty("logging.file.name");
        return new LogFiles(file == null || file.isBlank() ? null : Path.of(file));
    }

    @Bean
    LogSearch logSearch(LogFiles files, JsonMapper json) {
        return new LogSearch(files, json);
    }

    @Bean
    LogLevels logLevels(ObjectProvider<LoggingSystem> logging, Clock clock) {
        return new LogLevels(logging.getIfAvailable(() -> LoggingSystem.get(getClass().getClassLoader())), clock);
    }

    @Bean
    SystemStatus systemStatus(PlatformProperties platform, LogFiles files, ObjectProvider<BuildProperties> build,
            ObjectProvider<HealthEndpoint> health, Clock clock) {
        return new SystemStatus(platform.dataDir(), files, platform.timezone().getId(), build, health, clock);
    }

    @Bean
    EventPublications eventPublications(ObjectProvider<EventPublicationRegistry> registry,
            ObjectProvider<IncompleteEventPublications> incomplete) {
        return new EventPublications(registry, incomplete);
    }

    @Bean
    IntegrationChecks integrationChecks(ObjectProvider<IntegrationCheck> checks) {
        return new IntegrationChecks(checks);
    }

    @Bean
    DiagnosticsArchive diagnosticsArchive(ConfigurableEnvironment environment, SystemStatus status,
            EventPublications events, LogFiles files, JsonMapper json) {
        return new DiagnosticsArchive(environment, status, events, files, json);
    }
}
