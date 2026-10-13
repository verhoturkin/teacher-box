package ru.teacherbox.ai.application;

import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * Settings of the AI module ({@code TEACHERBOX_AI_*}). The module is off until a provider is set.
 *
 * @param provider          {@code anthropic}, {@code gemini}, {@code openrouter}, {@code deepseek} or
 *                          {@code openai-compatible}; empty disables AI
 * @param apiKey            key of the provider (may be empty for local servers such as Ollama)
 * @param model             model id; Anthropic, Gemini, OpenRouter and DeepSeek have defaults
 * @param baseUrl           API address; required for OpenAI-compatible providers, optional for the others
 *                          (e.g. {@code https://api.openai.com/v1}, {@code http://ollama:11434/v1})
 * @param effort            Anthropic effort ({@code low} … {@code max}); empty uses the model default
 * @param fallbacks         Anthropic server-side fallbacks when the model declines a request
 * @param maxTokens         output limit of one answer
 * @param timeout           timeout of one HTTP call to the provider
 * @param monthlyTokenLimit input + output tokens per calendar month, {@code 0} = unlimited
 * @param proxy             {@code http://host:port} or {@code socks5://host:port} when the provider is
 *                          blocked from the server's network
 */
@ConfigurationProperties("teacherbox.ai")
public record AiProperties(
        @Nullable String provider,
        @Nullable String apiKey,
        @Nullable String model,
        @Nullable String baseUrl,
        @Nullable String effort,
        @DefaultValue("true") boolean fallbacks,
        @DefaultValue("16000") long maxTokens,
        @DefaultValue("120s") Duration timeout,
        @DefaultValue("2000000") long monthlyTokenLimit,
        @Nullable String proxy) {

    public static final String ANTHROPIC = "anthropic";
    public static final String OPENAI_COMPATIBLE = "openai-compatible";
    public static final String GEMINI = "gemini";
    public static final String OPENROUTER = "openrouter";
    public static final String DEEPSEEK = "deepseek";
    public static final String DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";
    public static final String DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
    /** OpenAI-compatible endpoint of the Gemini API. */
    public static final String GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    /** OpenRouter's router: picks a model for each request among those that fit it. */
    public static final String DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
    public static final String OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
    public static final String DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
    public static final String DEEPSEEK_BASE_URL = "https://api.deepseek.com";

    private static final Set<String> PROVIDERS = Set.of(ANTHROPIC, GEMINI, OPENROUTER, DEEPSEEK, OPENAI_COMPATIBLE);

    public AiProperties {
        String id = provider == null ? "" : provider.strip().toLowerCase(Locale.ROOT);
        if (!id.isEmpty() && !PROVIDERS.contains(id)) {
            throw new IllegalArgumentException(
                    "TEACHERBOX_AI_PROVIDER must be anthropic, gemini, openrouter, deepseek or openai-compatible, got "
                            + provider);
        }
    }

    /** Normalized provider id, empty when AI is off. */
    public String providerId() {
        return provider == null ? "" : provider.strip().toLowerCase(Locale.ROOT);
    }

    /** The proxy for calls to the provider, or {@code null} for direct calls. */
    public @Nullable OutboundProxy outboundProxy() {
        return OutboundProxy.setting("TEACHERBOX_AI_PROXY", proxy);
    }

    public static boolean hasText(@Nullable String value) {
        return value != null && !value.isBlank();
    }
}
