package ru.teacherbox.homework.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import ru.teacherbox.homework.domain.VideoLink.Provider;
import ru.teacherbox.shared.error.BusinessRuleException;

class VideoLinkTest {

    @ParameterizedTest
    @CsvSource(nullValues = "-", value = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ, YOUTUBE, dQw4w9WgXcQ, -",
            "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=90, YOUTUBE, dQw4w9WgXcQ, 90",
            "https://youtu.be/dQw4w9WgXcQ?t=1h2m3s, YOUTUBE, dQw4w9WgXcQ, 3723",
            "https://youtube.com/shorts/dQw4w9WgXcQ, YOUTUBE, dQw4w9WgXcQ, -",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30, YOUTUBE, dQw4w9WgXcQ, 30",
            "https://www.youtube.com/live/dQw4w9WgXcQ, YOUTUBE, dQw4w9WgXcQ, -",
            "https://rutube.ru/video/0123456789ABCDEF0123456789abcdef/, RUTUBE, 0123456789abcdef0123456789abcdef, -",
            "https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef, RUTUBE, 0123456789abcdef0123456789abcdef, -",
            "https://vk.com/video-123_456, VK, -123_456, -",
            "https://vkvideo.ru/video123_456?list=x, VK, 123_456, -",
            "https://vk.com/club1?z=video-1_2%2Fpl, VK, -1_2, -",
            "https://vkvideo.ru/video_ext.php?oid=-7&id=8&hash=abc, VK, -7_8, -",
            "https://www.youtube.com/watch?v=short, OTHER, -, -",
            "https://www.youtube.com/channel/abc, OTHER, -, -",
            "https://youtu.be/, OTHER, -, -",
            "https://rutube.ru/channel/1/, OTHER, -, -",
            "https://vk.com/video_ext.php?oid=-7, OTHER, -, -",
            "https://vk.com/id1, OTHER, -, -",
            "http://example.com/a.mp4, OTHER, -, -",
    })
    void recognizesThePlayers(String url, Provider provider, String videoId, Integer start) {
        VideoLink link = VideoLink.parse("  " + url + " ");

        assertThat(link.url()).isEqualTo(url);
        assertThat(link.provider()).isEqualTo(provider);
        assertThat(link.videoId()).isEqualTo(videoId);
        assertThat(link.startSeconds()).isEqualTo(start);
    }

    @ParameterizedTest
    @ValueSource(strings = {"youtube.com/watch?v=dQw4w9WgXcQ", "ftp://example.com/v", "https://", "http://a b",
            "javascript:alert(1)"})
    void rejectsWhatIsNotAWebLink(String text) {
        assertThatThrownBy(() -> VideoLink.parse(text))
                .isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "video.link-invalid");
        assertThatThrownBy(() -> VideoLink.parse("https://example.com/" + "a".repeat(VideoLink.MAX_URL)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @ParameterizedTest
    @CsvSource(nullValues = "-", value = {"90, 90", "90s, 90", "2m, 120", "1h, 3600", "0, -", "abc, -", "'', -",
            "99999999999h, -"})
    void readsTheStartTime(String time, Integer seconds) {
        assertThat(VideoLink.seconds(time)).isEqualTo(seconds);
        assertThat(VideoLink.seconds(null)).isNull();
    }

    @Test
    void keepsTheTranscriptWithinLimits() {
        VideoLink link = VideoLink.parse("https://youtu.be/dQw4w9WgXcQ");
        UUID id = UUID.randomUUID();

        AssignmentVideo video = new AssignmentVideo(id, id, 0, link, "  ", " [0:00] текст ", true);
        assertThat(video.title()).isNull();
        assertThat(video.transcript()).isEqualTo("[0:00] текст");
        assertThatThrownBy(() -> new AssignmentVideo(id, id, 0, link, "x".repeat(201), null, false))
                .hasFieldOrPropertyWithValue("code", "video.title-invalid");
        assertThatThrownBy(() -> new AssignmentVideo(id, id, 0, link, null, "x".repeat(100_001), false))
                .hasFieldOrPropertyWithValue("code", "video.transcript-too-long");
    }
}
