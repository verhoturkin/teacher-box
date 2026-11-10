package ru.teacherbox.ai.application;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The administrator's AI setting (ADR-0056, ADR-0057): the default proxy of the providers that have none of
 * their own. Read through {@code shared.settings.LiveProperties} on every use — it is live. The connection
 * settings that were {@code TEACHERBOX_AI_*} variables are the providers and models of the {@code ai} schema.
 *
 * @param proxy {@code http://host:port} or {@code socks5://host:port} when the providers are blocked from the
 *              server's network (Anthropic, OpenAI and Gemini from Russia)
 */
@ConfigurationProperties("teacherbox.ai")
public record AiProperties(@Nullable String proxy) {
}
