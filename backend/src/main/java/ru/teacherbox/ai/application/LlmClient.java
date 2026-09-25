package ru.teacherbox.ai.application;

/**
 * A language model provider (SPI). A bean exists only when {@code TEACHERBOX_AI_PROVIDER} selects
 * the adapter; without it the AI features are switched off.
 */
public interface LlmClient {

    /** Provider id for the usage log, e.g. {@code anthropic}. */
    String provider();

    /** Configured model id. */
    String model();

    /**
     * Sends one request and returns the JSON answer that matches {@link LlmRequest#schema()}.
     *
     * @throws LlmException if the provider failed, declined the request or cut the answer short
     */
    LlmResponse complete(LlmRequest request);
}
