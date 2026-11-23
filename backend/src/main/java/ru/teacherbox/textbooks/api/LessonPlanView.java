package ru.teacherbox.textbooks.api;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A lesson plan as other modules see it (ADR-0071): the teacher's content, every transcript included — the
 * caller hides one from a student unless {@link Video#transcriptShown()}.
 *
 * @param courseId the course of the plan; {@code null} — none
 * @param bank     an original of the bank, never on a lesson
 * @param textbooks the textbooks that still exist, in the teacher's order
 */
public record LessonPlanView(UUID id, String title, String body, @Nullable UUID courseId, boolean bank,
        List<Textbook> textbooks, List<Video> videos) {

    /** @param pages the normalized pages ({@code 1-3, 7}); {@code null} — the whole textbook */
    public record Textbook(UUID id, String title, TextbookKind kind, TextbookFormat format, @Nullable String pages) {
    }

    /**
     * @param videoId      the video on its platform; {@code null} — a plain link opened in a new tab
     * @param startSeconds where the player starts; {@code null} — from the beginning
     * @param transcript   {@code null} — none
     */
    public record Video(String url, VideoLink.Provider provider, @Nullable String videoId,
            @Nullable Integer startSeconds, @Nullable String title, @Nullable String transcript,
            boolean transcriptShown) {
    }
}
