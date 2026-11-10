package ru.teacherbox.ai.domain;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher's AI settings (ADR-0057).
 *
 * @param defaultModelId    the model of a request that names none; {@code null} — the AI is off
 * @param monthlyTokenLimit input + output tokens per calendar month for all models, {@code 0} = unlimited
 */
public record AiSettings(@Nullable UUID defaultModelId, long monthlyTokenLimit, long version) {

    public static final long DEFAULT_MONTHLY_TOKEN_LIMIT = 2_000_000;

    /** No row yet: no default model and the default limit. */
    public static final AiSettings NONE = new AiSettings(null, DEFAULT_MONTHLY_TOKEN_LIMIT, 0);

    public AiSettings {
        if (monthlyTokenLimit < 0) {
            throw new IllegalArgumentException("The monthly token limit must not be negative");
        }
    }
}
