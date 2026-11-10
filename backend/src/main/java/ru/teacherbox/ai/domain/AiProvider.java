package ru.teacherbox.ai.domain;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A connection to an AI service (ADR-0057): its kind, key, address and proxy. The key is stored as the
 * messenger tokens are, inside the module's schema and the backups.
 *
 * @param apiKey  {@code null} for a local server that needs none
 * @param baseUrl {@code null} for the kind's address
 * @param proxy   {@code null} for the administrator's default AI proxy
 */
public record AiProvider(UUID id, ProviderKind kind, String name, @Nullable String apiKey, @Nullable String baseUrl,
        @Nullable String proxy, int position, long version) {

    public static final int MAX_NAME = 60;

    public AiProvider {
        name = name.strip();
        if (name.isEmpty() || name.length() > MAX_NAME) {
            throw new IllegalArgumentException("A provider name has 1–" + MAX_NAME + " characters");
        }
        apiKey = blankToNull(apiKey);
        baseUrl = blankToNull(baseUrl);
        proxy = blankToNull(proxy);
    }

    /** The API address in use: the given one or the kind's. */
    public @Nullable String address() {
        return baseUrl != null ? baseUrl : kind.defaultBaseUrl();
    }

    static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
