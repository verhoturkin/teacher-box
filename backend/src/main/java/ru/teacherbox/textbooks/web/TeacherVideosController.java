package ru.teacherbox.textbooks.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.textbooks.api.VideoCaptions;
import ru.teacherbox.textbooks.api.VideoLink;
import ru.teacherbox.textbooks.api.VideoTranscripts;

/** Captions of videos for the teacher's materials: homework and lesson plans (ADR-0047). */
@RestController
@RequestMapping("/api/teacher/textbooks/videos")
class TeacherVideosController {

    record CaptionsRequest(@NotBlank @Size(max = VideoLink.MAX_URL) String url) {
    }

    /**
     * @param language  the code of the chosen caption track; {@code null} — the suggested track
     * @param automatic the chosen track is recognized by YouTube
     */
    record TranscriptRequest(@NotBlank @Size(max = VideoLink.MAX_URL) String url,
            @Size(max = 35) @Nullable String language, @Nullable Boolean automatic) {

        VideoCaptions.@Nullable Track track() {
            return language == null || language.isBlank() ? null
                    : new VideoCaptions.Track(language, Boolean.TRUE.equals(automatic));
        }
    }

    private final VideoTranscripts transcripts;

    TeacherVideosController(VideoTranscripts transcripts) {
        this.transcripts = transcripts;
    }

    /** «Взять субтитры с YouTube» (ADR-0047): the caption tracks of the video to choose from. */
    @PostMapping("/captions")
    VideoCaptions.Tracks captions(@Valid @RequestBody CaptionsRequest request) {
        return transcripts.youtubeTracks(request.url());
    }

    /** «Взять субтитры с YouTube» (ADR-0047): the captions of the video as a transcript; nothing is saved. */
    @PostMapping("/transcript")
    VideoTranscripts.Transcript transcript(@Valid @RequestBody TranscriptRequest request) {
        return transcripts.youtube(request.url(), request.track());
    }
}
