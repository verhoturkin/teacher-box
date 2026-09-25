package ru.teacherbox.ai.application;

import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;

/** Inputs and read models of the AI API. */
public final class AiViews {

    private AiViews() {
    }

    /** What the teacher wants the homework to be about. */
    public record HomeworkBrief(String topic, @Nullable String level, int taskCount, @Nullable String wishes) {
    }

    /** A draft of an assignment for the homework editor. */
    public record HomeworkDraft(String title, String description) {
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
}
