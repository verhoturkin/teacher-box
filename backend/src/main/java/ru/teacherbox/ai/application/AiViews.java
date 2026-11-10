package ru.teacherbox.ai.application;

import ru.teacherbox.homework.api.QuizDrafts;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.domain.SavedPrompt;

/** Inputs and read models of the AI API. */
public final class AiViews {

    private AiViews() {
    }

    /**
     * What the teacher wants: the request in their own words.
     *
     * @param title   what the teacher already called the assignment, if anything
     * @param sources textbook pages and files of the assignment to base the draft on (ADR-0039)
     * @param context what the teacher noted about the recipients (ADR-0055)
     * @param modelId the configured model to ask (ADR-0057); {@code null} — the default one
     */
    public record HomeworkBrief(String prompt, @Nullable String title, List<DraftSources.Source> sources,
            List<StudentNote> context, @Nullable UUID modelId) {

        public HomeworkBrief {
            sources = List.copyOf(sources);
            context = List.copyOf(context);
        }
    }

    /**
     * A student tag the frontend sends as a default of a draft (ADR-0055); several values of one tag come joined.
     *
     * @param name  the tag, e.g. «Уровень английского»
     * @param value its value, e.g. «B1» or «7 · 8»
     */
    public record StudentNote(String name, String value) {
    }

    /** A draft of the questions of an assignment, valid by the rules of a quiz, for the question editor. */
    public record QuizDraft(List<QuizDrafts.Drafted> questions) {
    }

    /** A draft of an assignment for the homework editor. */
    public record HomeworkDraft(String title, String description) {
    }

    /**
     * Texts of the task and the student's answer and the student's tags; the frontend sends them explicitly.
     *
     * @param modelId the configured model to ask; {@code null} — the default one
     */
    public record ReviewBrief(String title, @Nullable String description, String answer, List<StudentNote> context,
            @Nullable UUID modelId) {

        public ReviewBrief {
            context = List.copyOf(context);
        }
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
     * What the teacher knows about a lesson; the frontend sends the texts.
     *
     * @param assignmentTitles titles of the assignments given at the lesson
     * @param modelId          the configured model to ask; {@code null} — the default one
     */
    public record LessonSummaryBrief(@Nullable String topic, @Nullable String words, List<String> assignmentTitles,
            @Nullable UUID modelId) {

        public LessonSummaryBrief {
            assignmentTitles = List.copyOf(assignmentTitles);
        }
    }

    /** A draft of the lesson summary in Markdown. */
    public record LessonSummaryDraft(String summary) {
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

    /**
     * Usage of one model in a month (ADR-0057); the monthly limit is one for all the models.
     *
     * @param modelId  the configured model, {@code null} for requests logged before models had ids
     * @param label    the model's label, or the model id the provider answered with once it is removed
     * @param provider the provider kind, e.g. {@code anthropic}
     * @param removed  whether the model is no longer configured
     */
    public record ModelUsage(@Nullable UUID modelId, String label, String provider, boolean removed, long requests,
            long inputTokens, long outputTokens) {
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
     * @param month      {@code yyyy-MM}
     * @param models     the configured models in their order, then the removed ones by tokens; only those with
     *                   requests in the month
     * @param recent     the newest requests of the month, the first page
     * @param moreRecent whether the month has older requests than {@code recent}
     */
    public record UsageReport(
            String month,
            long usedTokens,
            long monthlyTokenLimit,
            List<FeatureUsage> features,
            List<ModelUsage> models,
            List<RequestView> recent,
            boolean moreRecent) {
    }

    /** A page of the request log, newest first. */
    public record RequestPage(List<RequestView> items, boolean hasMore) {

        public RequestPage {
            items = List.copyOf(items);
        }
    }

    /**
     * A system prompt of the assistant (ADR-0043).
     *
     * @param custom    whether the teacher rewrote it; otherwise {@code text} is the default one
     * @param updatedAt when the teacher saved it, {@code null} for the default prompt
     * @param version   {@code 0} for the default prompt
     */
    public record SystemPromptView(
            AiFeature feature,
            String text,
            String defaultText,
            boolean custom,
            @Nullable Instant updatedAt,
            long version) {
    }

    /** A prompt of the library. */
    public record PromptView(UUID id, String title, String text, Instant updatedAt, long version) {

        static PromptView of(SavedPrompt prompt) {
            return new PromptView(prompt.id(), prompt.title(), prompt.text(), prompt.updatedAt(), prompt.version());
        }
    }
}
