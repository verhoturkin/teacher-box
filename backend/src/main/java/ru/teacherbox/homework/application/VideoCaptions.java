package ru.teacherbox.homework.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Captions of a YouTube video (ADR-0047), implemented by the {@code youtube} adapter. */
public interface VideoCaptions {

    /**
     * @param language  the code of the track ({@code en}, {@code ru}…)
     * @param automatic recognized by YouTube, not written by the author
     * @param cues      in the order of the video
     */
    record Captions(@Nullable String title, String language, boolean automatic, List<Cue> cues) {

        public Captions {
            cues = List.copyOf(cues);
        }
    }

    /** @param startMillis from the beginning of the video */
    record Cue(long startMillis, String text) {
    }

    /**
     * @throws BusinessRuleException {@code video.captions-none} if the video has no captions,
     *                               {@code video.captions-failed} if YouTube can't be read
     */
    Captions fetch(String videoId);
}
