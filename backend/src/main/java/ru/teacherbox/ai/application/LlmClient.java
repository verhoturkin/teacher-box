package ru.teacherbox.ai.application;

import ru.teacherbox.shared.i18n.Language;

/**
 * A client of one model of a provider, built by its {@link LlmAdapter} and kept by {@link LlmClients}
 * (ADR-0057).
 */
public interface LlmClient {

    /** Provider kind for the usage log, e.g. {@code anthropic}. */
    String provider();

    /** Configured model id. */
    String model();

    /**
     * Sends one request and returns the JSON answer that matches {@link LlmRequest#schema()}.
     *
     * @throws LlmException if the provider failed, declined the request or cut the answer short
     */
    LlmResponse complete(LlmRequest request);

    /**
     * Checks that the provider answers and accepts the key, without spending tokens (the administrator's
     * integration check).
     *
     * @return what the provider said about the model, e.g. its display name
     * @throws LlmException if the provider is unreachable or rejects the request
     */
    String ping(Language language);
}
