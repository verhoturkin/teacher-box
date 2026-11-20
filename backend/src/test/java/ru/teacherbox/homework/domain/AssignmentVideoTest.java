package ru.teacherbox.homework.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.textbooks.api.VideoLink;

class AssignmentVideoTest {

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
