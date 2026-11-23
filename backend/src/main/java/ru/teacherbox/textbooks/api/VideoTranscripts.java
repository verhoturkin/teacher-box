package ru.teacherbox.textbooks.api;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import ru.teacherbox.textbooks.api.VideoCaptions.Captions;
import ru.teacherbox.textbooks.api.VideoCaptions.Cue;
import ru.teacherbox.textbooks.api.VideoCaptions.Track;
import ru.teacherbox.textbooks.api.VideoCaptions.Tracks;
import ru.teacherbox.shared.error.BusinessRuleException;

/** «Взять субтитры с YouTube» (ADR-0047): the captions of a video as a transcript the teacher edits. */
@Service
public class VideoTranscripts {

    /** The longest transcript (characters); a longer one is cut off. */
    public static final int MAX_TRANSCRIPT = 100_000;

    /** A new paragraph of the transcript starts this long after the previous one. */
    static final long PARAGRAPH_MILLIS = 30_000;

    /**
     * @param transcript paragraphs {@code [m:ss] text}
     * @param truncated  the captions were longer than a transcript may be: the end is cut off
     * @param otherTracks the video has captions of another track: «Сменить язык» has something to offer
     */
    public record Transcript(@Nullable String title, String language, boolean automatic, String transcript,
            boolean truncated, boolean otherTracks) {
    }

    private final VideoCaptions captions;

    public VideoTranscripts(VideoCaptions captions) {
        this.captions = captions;
    }

    /**
     * The caption tracks of a video, for the teacher to choose one.
     *
     * @throws BusinessRuleException {@code video.not-youtube} for a link that is not a YouTube video, and the errors
     *                               of {@link VideoCaptions#tracks}
     */
    public Tracks youtubeTracks(String url) {
        return captions.tracks(youtubeId(url));
    }

    /**
     * @param track the track the teacher chose; {@code null} — the suggested one
     * @throws BusinessRuleException {@code video.not-youtube} for a link that is not a YouTube video, and the errors
     *                               of {@link VideoCaptions#fetch}
     */
    public Transcript youtube(String url, @Nullable Track track) {
        Captions found = captions.fetch(youtubeId(url), track);
        StringBuilder text = new StringBuilder();
        boolean truncated = false;
        for (String paragraph : paragraphs(found.cues())) {
            int length = text.isEmpty() ? paragraph.length() : paragraph.length() + 1;
            if (text.length() + length > MAX_TRANSCRIPT) {
                truncated = true;
                break;
            }
            text.append(text.isEmpty() ? "" : "\n").append(paragraph);
        }
        if (text.isEmpty()) {
            throw new BusinessRuleException("video.captions-none", "The video has no captions");
        }
        return new Transcript(found.title(), found.language(), found.automatic(), text.toString(), truncated,
                found.otherTracks());
    }

    private static String youtubeId(String url) {
        VideoLink link = VideoLink.parse(url);
        if (link.provider() != VideoLink.Provider.YOUTUBE || link.videoId() == null) {
            throw new BusinessRuleException("video.not-youtube", "Captions are taken from YouTube videos only");
        }
        return link.videoId();
    }

    /** Cues merged into paragraphs of about 30 seconds, each with its start time. */
    static List<String> paragraphs(List<Cue> cues) {
        List<String> paragraphs = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        long start = 0;
        for (Cue cue : cues) {
            String text = cue.text().replaceAll("\\s+", " ").strip();
            if (text.isEmpty()) {
                continue;
            }
            if (!current.isEmpty() && cue.startMillis() - start >= PARAGRAPH_MILLIS) {
                paragraphs.add(current.toString());
                current.setLength(0);
            }
            if (current.isEmpty()) {
                start = cue.startMillis();
                current.append('[').append(time(start)).append(']');
            }
            current.append(' ').append(text);
        }
        if (!current.isEmpty()) {
            paragraphs.add(current.toString());
        }
        return paragraphs;
    }

    /** {@code 0:05}, {@code 12:34}, {@code 1:02:03}. */
    static String time(long millis) {
        long seconds = millis / 1000;
        long hours = seconds / 3600;
        long minutes = seconds / 60 % 60;
        return hours > 0 ? "%d:%02d:%02d".formatted(hours, minutes, seconds % 60)
                : "%d:%02d".formatted(minutes, seconds % 60);
    }
}
