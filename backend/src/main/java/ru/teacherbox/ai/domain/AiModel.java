package ru.teacherbox.ai.domain;

import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A model of a provider the teacher can pick (ADR-0057).
 *
 * @param modelId   the provider's id of the model, e.g. {@code claude-opus-5}
 * @param label     what the teacher sees, e.g. «Claude Opus 5»
 * @param effort    Anthropic effort ({@code low} … {@code max}); {@code null} — the model's default
 * @param fallbacks Anthropic server-side fallbacks when the model declines a request
 * @param maxTokens output limit of one answer
 * @param timeout   timeout of one HTTP call
 */
public record AiModel(UUID id, UUID providerId, String modelId, String label, @Nullable String effort,
        boolean fallbacks, long maxTokens, Duration timeout, int position, long version) {

    public static final int MAX_MODEL_ID = 120;
    public static final int MAX_LABEL = 60;
    public static final long DEFAULT_MAX_TOKENS = 16_000;
    public static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(120);
    public static final Set<String> EFFORTS = Set.of("low", "medium", "high", "xhigh", "max");

    public AiModel {
        modelId = modelId.strip();
        label = label.strip();
        if (modelId.isEmpty() || modelId.length() > MAX_MODEL_ID) {
            throw new IllegalArgumentException("A model id has 1–" + MAX_MODEL_ID + " characters");
        }
        if (label.isEmpty() || label.length() > MAX_LABEL) {
            throw new IllegalArgumentException("A model label has 1–" + MAX_LABEL + " characters");
        }
        effort = effort(effort);
        if (maxTokens <= 0 || timeout.toSeconds() <= 0) {
            throw new IllegalArgumentException("The output limit and the timeout must be positive");
        }
    }

    /** The effort normalised, {@code null} for none; an unknown one is refused. */
    public static @Nullable String effort(@Nullable String value) {
        String effort = AiProvider.blankToNull(value);
        if (effort == null) {
            return null;
        }
        effort = effort.toLowerCase(Locale.ROOT);
        if (!EFFORTS.contains(effort)) {
            throw new IllegalArgumentException("The effort must be one of " + EFFORTS + ", got " + value);
        }
        return effort;
    }

    /** A label from a model id: the id itself, cut to {@link #MAX_LABEL}. */
    public static String labelOf(String modelId) {
        String id = modelId.strip();
        return id.length() > MAX_LABEL ? id.substring(0, MAX_LABEL) : id;
    }
}
