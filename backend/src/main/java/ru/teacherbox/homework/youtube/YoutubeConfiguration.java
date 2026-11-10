package ru.teacherbox.homework.youtube;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestClient;
import ru.teacherbox.homework.application.HomeworkProperties;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.settings.LiveProperties;
import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
class YoutubeConfiguration {

    /** The proxy is read on every request: the administrator changes it without a restart (ADR-0056). */
    @Bean
    VideoCaptions youtubeCaptions(Environment environment, JsonMapper json) {
        LiveProperties<HomeworkProperties> properties = new LiveProperties<>(environment, HomeworkProperties.class);
        RestClient http = RestClient.builder()
                .requestFactory(OutboundHttp.liveRequestFactory(HomeworkProperties.YOUTUBE_PROXY,
                        () -> properties.get().youtubeProxy(), Duration.ofSeconds(10), Duration.ofSeconds(30)))
                .build();
        return new YoutubeCaptions(http, json);
    }
}
