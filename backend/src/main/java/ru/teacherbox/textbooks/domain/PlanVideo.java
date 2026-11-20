package ru.teacherbox.textbooks.domain;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.textbooks.api.VideoLink;
import ru.teacherbox.textbooks.api.VideoTranscripts;

/**
 * A video of a lesson plan, the shape of homework's assignment videos (ADR-0047).
 *
 * @param transcript      lines {@code [m:ss] text}; {@code null} — none
 * @param transcriptShown the student sees the transcript under the player; off by default
 */
public record PlanVideo(UUID id, UUID planId, int position, VideoLink link, @Nullable String title,
        @Nullable String transcript, boolean transcriptShown) {

    public static final int MAX_PER_PLAN = 5;
    public static final int MAX_TITLE = 200;

    public PlanVideo {
        Objects.requireNonNull(id);
        Objects.requireNonNull(planId);
        Objects.requireNonNull(link);
        title = blankToNull(title);
        transcript = blankToNull(transcript);
        if (title != null && title.length() > MAX_TITLE) {
            throw new BusinessRuleException("video.title-invalid", "Video title is too long");
        }
        if (transcript != null && transcript.length() > VideoTranscripts.MAX_TRANSCRIPT) {
            throw new BusinessRuleException("video.transcript-too-long", "Transcript is too long");
        }
    }

    /** The same video in another plan. */
    public PlanVideo in(UUID copyId, UUID otherPlanId) {
        return new PlanVideo(copyId, otherPlanId, position, link, title, transcript,
                transcriptShown);
    }

    private static @Nullable String blankToNull(@Nullable String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
