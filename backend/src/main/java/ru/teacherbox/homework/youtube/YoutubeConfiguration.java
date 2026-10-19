package ru.teacherbox.homework.youtube;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import ru.teacherbox.homework.application.HomeworkProperties;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.http.OutboundProxy;
import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
class YoutubeConfiguration {

    private static final Logger log = LoggerFactory.getLogger(YoutubeConfiguration.class);

    @Bean
    VideoCaptions youtubeCaptions(HomeworkProperties properties, JsonMapper json) {
        OutboundProxy proxy = properties.outboundYoutubeProxy();
        if (proxy != null) {
            log.info("YouTube captions are read through the proxy {}", proxy);
        }
        RestClient http = RestClient.builder()
                .requestFactory(OutboundHttp.requestFactory(Duration.ofSeconds(10), Duration.ofSeconds(30), proxy))
                .build();
        return new YoutubeCaptions(http, json);
    }
}
