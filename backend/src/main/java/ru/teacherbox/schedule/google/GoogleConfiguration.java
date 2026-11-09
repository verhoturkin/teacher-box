package ru.teacherbox.schedule.google;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestClient;
import ru.teacherbox.schedule.application.ScheduleProperties;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.settings.LiveProperties;

/** HTTP clients of Google OAuth and the Calendar API (with {@code TEACHERBOX_SCHEDULE_GOOGLE_PROXY}). */
@Configuration(proxyBeanMethods = false)
class GoogleConfiguration {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);
    static final String PROXY = "TEACHERBOX_SCHEDULE_GOOGLE_PROXY";

    /** The proxy is read on every request: the administrator changes it without a restart (ADR-0056). */
    @Bean
    GoogleApi googleApi(RestClient.Builder builder, ScheduleProperties properties, Environment environment) {
        ScheduleProperties.Google google = properties.google();
        LiveProperties<ScheduleProperties> live = new LiveProperties<>(environment, ScheduleProperties.class);
        RestClient.Builder http = builder.clone().requestFactory(OutboundHttp.liveRequestFactory(PROXY,
                () -> live.get().google().proxy(), CONNECT_TIMEOUT, READ_TIMEOUT));
        return new GoogleApi(http.clone().baseUrl(google.oauthUrl()).build(),
                http.clone().baseUrl(google.apiUrl()).build(), google.authorizationUrl());
    }
}
