package ru.teacherbox.ai.application;

import java.time.Duration;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * Settings of the AI module ({@code TEACHERBOX_AI_*}). The module is off until a provider is set.
 *
 * @param provider          {@code anthropic} or {@code openai-compatible}; empty disables AI
 * @param apiKey            key of the provider (may be empty for local servers such as Ollama)
 * @param model             model id; for Anthropic defaults to {@link #DEFAULT_ANTHROPIC_MODEL}
 * @param baseUrl           API address; required for OpenAI-compatible providers
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
    public static final String DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";

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
