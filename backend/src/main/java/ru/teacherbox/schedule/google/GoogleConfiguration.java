package ru.teacherbox.schedule.google;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import ru.teacherbox.schedule.application.ScheduleProperties;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.http.OutboundProxy;

/** HTTP clients of Google OAuth and the Calendar API (with {@code TEACHERBOX_SCHEDULE_GOOGLE_PROXY}). */
@Configuration(proxyBeanMethods = false)
class GoogleConfiguration {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);
    private static final Logger log = LoggerFactory.getLogger(GoogleConfiguration.class);

    @Bean
    GoogleApi googleApi(RestClient.Builder builder, ScheduleProperties properties) {
        ScheduleProperties.Google google = properties.google();
        OutboundProxy proxy = OutboundProxy.setting("TEACHERBOX_SCHEDULE_GOOGLE_PROXY", google.proxy());
        if (proxy != null) {
            log.info("Google APIs are reached through the proxy {}", proxy);
        }
        RestClient.Builder http = builder.clone()
                .requestFactory(OutboundHttp.requestFactory(CONNECT_TIMEOUT, READ_TIMEOUT, proxy));
        return new GoogleApi(http.clone().baseUrl(google.oauthUrl()).build(),
                http.clone().baseUrl(google.apiUrl()).build(), google.authorizationUrl());
    }
}
