package ru.teacherbox.ai.application;

import java.util.Map;

/**
 * A single-turn request with a structured (JSON) answer.
 *
 * @param system     instructions for the model
 * @param prompt     the user message
 * @param schemaName short name of the answer format (used by OpenAI-compatible APIs)
 * @param schema     JSON Schema of the answer object
 */
public record LlmRequest(String system, String prompt, String schemaName, Map<String, Object> schema) {
}
