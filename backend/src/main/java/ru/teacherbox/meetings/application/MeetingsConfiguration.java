package ru.teacherbox.meetings.application;

import java.time.Duration;
import javax.sql.DataSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MeetingsProperties.class)
class MeetingsConfiguration {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);

    @Bean
    FlywayMigrationInitializer meetingsMigrations(DataSource dataSource) {
        return ModuleMigrations.initializer(dataSource, "meetings");
    }

    /** Yandex services are reachable from Russia: no proxy. */
    @Bean
    TelemostApi telemostApi(RestClient.Builder builder, MeetingsProperties properties) {
        RestClient.Builder http = builder.clone()
                .requestFactory(OutboundHttp.requestFactory(CONNECT_TIMEOUT, READ_TIMEOUT, null));
        String oauthUrl = properties.yandex().oauthUrl();
        return new TelemostApi(http.clone().baseUrl(oauthUrl).build(),
                http.clone().baseUrl(properties.telemost().apiUrl()).build(), oauthUrl);
    }
}
