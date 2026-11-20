package ru.teacherbox.textbooks.youtube;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestClient;
import ru.teacherbox.textbooks.api.VideoCaptions;
import ru.teacherbox.shared.http.OutboundHttp;
import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
class YoutubeConfiguration {

    /**
     * The variable keeps its name from before the move out of {@code homework}, so existing {@code .env} files work;
     * the proxy serves the captions of assignments and of lesson plans alike.
     */
    static final String YOUTUBE_PROXY = "TEACHERBOX_HOMEWORK_YOUTUBE_PROXY";
    static final String YOUTUBE_PROXY_PROPERTY = "teacherbox.homework.youtube-proxy";

    /** The proxy is read on every request: the administrator changes it without a restart (ADR-0056). */
    @Bean
    VideoCaptions youtubeCaptions(Environment environment, JsonMapper json) {
        RestClient http = RestClient.builder()
                .requestFactory(OutboundHttp.liveRequestFactory(YOUTUBE_PROXY,
                        () -> environment.getProperty(YOUTUBE_PROXY_PROPERTY), Duration.ofSeconds(10), Duration.ofSeconds(30)))
                .build();
        return new YoutubeCaptions(http, json);
    }
}
