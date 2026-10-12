package ru.teacherbox.ai.application;

import java.util.List;
import java.util.Map;

/**
 * A single-turn request with a structured (JSON) answer.
 *
 * @param system     instructions for the model
 * @param prompt     the user message
 * @param schemaName short name of the answer format (used by OpenAI-compatible APIs)
 * @param schema     JSON Schema of the answer object
 * @param sources    materials the model reads before the prompt (ADR-0039)
 */
public record LlmRequest(String system, String prompt, String schemaName, Map<String, Object> schema,
        List<LlmSource> sources) {

    public LlmRequest {
        sources = List.copyOf(sources);
    }

    /** A request without materials. */
    public LlmRequest(String system, String prompt, String schemaName, Map<String, Object> schema) {
        this(system, prompt, schemaName, schema, List.of());
    }
}
