package ru.teacherbox.homework.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.homework.FakeVideoCaptions;
import ru.teacherbox.homework.application.VideoCaptions.Captions;
import ru.teacherbox.homework.application.VideoCaptions.Cue;
import ru.teacherbox.homework.domain.AssignmentVideo;

class VideoTranscriptsTest {

    @Test
    void writesTimes() {
        assertThat(VideoTranscripts.time(5_400)).isEqualTo("0:05");
        assertThat(VideoTranscripts.time(754_000)).isEqualTo("12:34");
        assertThat(VideoTranscripts.time(3_723_000)).isEqualTo("1:02:03");
    }

    @Test
    void cutsALongTranscript() {
        List<Cue> cues = new ArrayList<>();
        for (int i = 0; i < 300; i++) {
            cues.add(new Cue(i * 30_000L, "x".repeat(500)));
        }
        VideoTranscripts transcripts = transcripts(new Captions(null, "ru", false, cues));

        VideoTranscripts.Transcript transcript = transcripts.youtube("https://youtu.be/aaaaaaaaaaa", null);

        assertThat(transcript.truncated()).isTrue();
        assertThat(transcript.transcript().length()).isLessThanOrEqualTo(AssignmentVideo.MAX_TRANSCRIPT);
        assertThat(transcript.transcript()).startsWith("[0:00] xxx");
    }

    @Test
    void needsSomeText() {
        VideoTranscripts transcripts = transcripts(new Captions(null, "ru", false, List.of(new Cue(0, "  \n "))));

        assertThatThrownBy(() -> transcripts.youtube("https://youtu.be/aaaaaaaaaaa", null))
                .hasFieldOrPropertyWithValue("code", "video.captions-none");
        assertThatThrownBy(() -> transcripts.youtube("https://example.com/v", null))
                .hasFieldOrPropertyWithValue("code", "video.not-youtube");
        assertThatThrownBy(() -> transcripts.youtubeTracks("https://example.com/v"))
                .hasFieldOrPropertyWithValue("code", "video.not-youtube");
    }

    private static VideoTranscripts transcripts(Captions captions) {
        FakeVideoCaptions fake = new FakeVideoCaptions();
        fake.put("aaaaaaaaaaa", captions);
        return new VideoTranscripts(fake);
    }
}
