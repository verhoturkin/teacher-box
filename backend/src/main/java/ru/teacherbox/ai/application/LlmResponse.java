package ru.teacherbox.ai.application;

/**
 * Answer of the model.
 *
 * @param text  JSON text of the answer
 * @param model model that actually answered (may differ from the configured one after a fallback)
 */
public record LlmResponse(String text, String model, long inputTokens, long outputTokens) {
}
