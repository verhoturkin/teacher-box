package ru.teacherbox.ai.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

/** The API a provider speaks (ADR-0057); each has its adapter. */
public enum ProviderKind {

    ANTHROPIC("anthropic", "Anthropic", "claude-opus-5", null, true),
    /** Gemini through its OpenAI-compatible endpoint. */
    GEMINI("gemini", "Gemini", "gemini-3.8-flash", "https://generativelanguage.googleapis.com/v1beta/openai", true),
    /** OpenRouter's router picks a model for each request among those that fit it. */
    OPENROUTER("openrouter", "OpenRouter", "openrouter/auto", "https://openrouter.ai/api/v1", true),
    DEEPSEEK("deepseek", "DeepSeek", "deepseek-flash", "https://api.deepseek.com", true),
    /** Any {@code /chat/completions} API (OpenAI, Ollama, LM Studio, vLLM): the address and the model are required. */
    OPENAI_COMPATIBLE("openai-compatible", "OpenAI-compatible", null, null, false);

    private final String id;
    private final String title;
    private final @Nullable String defaultModel;
    private final @Nullable String defaultBaseUrl;
    private final boolean keyRequired;

    ProviderKind(String id, String title, @Nullable String defaultModel, @Nullable String defaultBaseUrl,
            boolean keyRequired) {
        this.id = id;
        this.title = title;
        this.defaultModel = defaultModel;
        this.defaultBaseUrl = defaultBaseUrl;
        this.keyRequired = keyRequired;
    }

    /** The id stored and shown in the usage log, e.g. {@code openai-compatible}. */
    public String id() {
        return id;
    }

    /** The name a new provider of this kind gets. */
    public String title() {
        return title;
    }

    /** The model a provider of this kind uses when none is given; {@code null} when one must be given. */
    public @Nullable String defaultModel() {
        return defaultModel;
    }

    /** The API address when none is given; {@code null} for the SDK default or when one must be given. */
    public @Nullable String defaultBaseUrl() {
        return defaultBaseUrl;
    }

    /** Whether the API takes no request without a key (a local OpenAI-compatible server may need none). */
    public boolean keyRequired() {
        return keyRequired;
    }

    /** By its id, in any case and with spaces around. */
    public static Optional<ProviderKind> of(@Nullable String value) {
        String id = value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(kind -> kind.id.equals(id)).findFirst();
    }
}
