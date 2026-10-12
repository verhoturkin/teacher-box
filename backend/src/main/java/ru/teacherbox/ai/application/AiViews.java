package ru.teacherbox.ai.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.HomeworkKind;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.domain.SavedPrompt;

/** Inputs and read models of the AI API. */
public final class AiViews {

    private AiViews() {
    }

    /**
     * What the teacher wants: the kind of homework and the request in their own words.
     *
     * @param title what the teacher already called the assignment, if anything
     * @param look  the portal's colours and font, for the page of interactive homework
     */
    public record HomeworkBrief(HomeworkKind kind, String prompt, @Nullable String title, PageLook look) {
    }

    /** The look of the portal an interactive page should follow: CSS colours and a font family. */
    public record PageLook(String font, String primary, String surface, String text) {

        /** For a request that names none. */
        public static final PageLook DEFAULT = new PageLook("system-ui, sans-serif", "#1b6b5a", "#ffffff",
                "#1a1c1b");
    }

    /**
     * A draft of an assignment for the homework editor.
     *
     * @param html the page of interactive homework; {@code null} for other kinds
     */
    public record HomeworkDraft(String title, String description, @Nullable String html) {
    }

    /** Texts of the task and the student's answer; the frontend sends them explicitly. */
    public record ReviewBrief(String title, @Nullable String description, String answer) {
    }

    /**
     * A draft of the teacher's review.
     *
     * @param grade  suggested grade or {@code null}
     * @param accept {@code true} to accept the work, {@code false} to return it for revision
     */
    public record ReviewDraft(String comment, @Nullable String grade, boolean accept) {
    }

    /**
     * Whether AI features can be used right now.
     *
     * @param monthlyTokenLimit {@code 0} means no limit
     */
    public record AiStatus(
            boolean enabled,
            @Nullable String provider,
            @Nullable String model,
            long usedThisMonth,
            long monthlyTokenLimit,
            boolean limitReached) {
    }

    public record FeatureUsage(AiFeature feature, long requests, long inputTokens, long outputTokens) {
    }

    public record RequestView(
            AiFeature feature,
            String model,
            RequestStatus status,
            long inputTokens,
            long outputTokens,
            long durationMs,
            @Nullable String error,
            Instant createdAt) {

        static RequestView of(AiRequest request) {
            return new RequestView(request.feature(), request.model(), request.status(), request.inputTokens(),
                    request.outputTokens(), request.durationMs(), request.error(), request.createdAt());
        }
    }

    /**
     * Usage in a calendar month (instance time zone).
     *
     * @param month {@code yyyy-MM}
     */
    public record UsageReport(
            String month,
            long usedTokens,
            long monthlyTokenLimit,
            List<FeatureUsage> features,
            List<RequestView> recent) {
    }

    /** A prompt of the library; {@code kind} {@code null} — for any kind of homework. */
    public record PromptView(UUID id, String title, String text, @Nullable HomeworkKind kind, Instant updatedAt,
            long version) {

        static PromptView of(SavedPrompt prompt) {
            return new PromptView(prompt.id(), prompt.title(), prompt.text(), prompt.kind(), prompt.updatedAt(),
                    prompt.version());
        }
    }
}
