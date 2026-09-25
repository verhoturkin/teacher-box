package ru.teacherbox.ai.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** One call to the language model (metadata only, no texts). */
public record AiRequest(
        UUID id,
        AiFeature feature,
        String provider,
        String model,
        RequestStatus status,
        long inputTokens,
        long outputTokens,
        long durationMs,
        @Nullable String error,
        Instant createdAt) {

    private static final int MAX_ERROR = 1000;

    public AiRequest {
        if (inputTokens < 0 || outputTokens < 0 || durationMs < 0) {
            throw new IllegalArgumentException("Token counts and duration must not be negative");
        }
        if (error != null && error.length() > MAX_ERROR) {
            error = error.substring(0, MAX_ERROR);
        }
    }

    public long totalTokens() {
        return inputTokens + outputTokens;
    }
}
