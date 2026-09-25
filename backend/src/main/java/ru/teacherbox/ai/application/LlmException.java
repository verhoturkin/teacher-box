package ru.teacherbox.ai.application;

/** The provider did not produce a usable answer. */
public class LlmException extends RuntimeException {

    public enum Reason {
        /** Network problem, rate limit, overload or an API error. */
        UNAVAILABLE,
        /** The model or its safety classifiers declined the request. */
        REFUSED,
        /** The answer hit the output limit and is incomplete. */
        TRUNCATED,
        /** The answer is not the requested JSON. */
        INVALID_ANSWER
    }

    private final Reason reason;
    private final long inputTokens;
    private final long outputTokens;

    public LlmException(Reason reason, String message) {
        this(reason, message, 0, 0);
    }

    /** With the tokens the provider has billed for the failed attempt. */
    public LlmException(Reason reason, String message, long inputTokens, long outputTokens) {
        super(message);
        this.reason = reason;
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
    }

    public Reason reason() {
        return reason;
    }

    public long inputTokens() {
        return inputTokens;
    }

    public long outputTokens() {
        return outputTokens;
    }
}
