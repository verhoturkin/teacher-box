package ru.teacherbox.homework.application;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * Settings of the homework module ({@code TEACHERBOX_HOMEWORK_*}).
 *
 * @param maxFileSize       maximum size of one attached file
 * @param maxFilesPerUpload maximum number of files in one submission
 * @param dueSoonWindow     how long before the deadline the reminder is sent
 * @param youtubeProxy      the proxy for YouTube captions (ADR-0047); blank — direct
 */
@ConfigurationProperties("teacherbox.homework")
public record HomeworkProperties(
        @DefaultValue("20MB") DataSize maxFileSize,
        @DefaultValue("10") int maxFilesPerUpload,
        @DefaultValue("24h") Duration dueSoonWindow,
        @Nullable String youtubeProxy) {

    /** The proxy for YouTube captions, or {@code null} for direct calls. */
    public @Nullable OutboundProxy outboundYoutubeProxy() {
        return OutboundProxy.setting("TEACHERBOX_HOMEWORK_YOUTUBE_PROXY", youtubeProxy);
    }
}
