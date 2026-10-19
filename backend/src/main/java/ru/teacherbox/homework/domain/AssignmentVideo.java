package ru.teacherbox.homework.domain;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A video of an assignment (ADR-0047): a link, its title and a transcript the AI reads and, when the teacher allows,
 * the student.
 *
 * @param transcript      lines {@code [m:ss] text}; {@code null} — none
 * @param transcriptShown the student sees the transcript under the player
 */
public record AssignmentVideo(UUID id, UUID assignmentId, int position, VideoLink link, @Nullable String title,
        @Nullable String transcript, boolean transcriptShown) {

    public static final int MAX_PER_ASSIGNMENT = 5;
    public static final int MAX_TITLE = 200;
    public static final int MAX_TRANSCRIPT = 100_000;

    public AssignmentVideo {
        Objects.requireNonNull(id);
        Objects.requireNonNull(assignmentId);
        Objects.requireNonNull(link);
        title = blankToNull(title);
        transcript = blankToNull(transcript);
        if (title != null && title.length() > MAX_TITLE) {
            throw new BusinessRuleException("video.title-invalid", "Video title is too long");
        }
        if (transcript != null && transcript.length() > MAX_TRANSCRIPT) {
            throw new BusinessRuleException("video.transcript-too-long", "Transcript is too long");
        }
    }

    private static @Nullable String blankToNull(@Nullable String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
