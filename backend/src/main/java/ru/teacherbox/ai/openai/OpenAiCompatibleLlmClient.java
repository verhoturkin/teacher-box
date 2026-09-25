package ru.teacherbox.ai.openai;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import tools.jackson.databind.JsonNode;

/**
 * Any provider with an OpenAI-compatible {@code /chat/completions} endpoint (OpenAI, OpenRouter,
 * Ollama, LM Studio, vLLM, ...). The answer format is requested with a JSON schema
 * {@code response_format}; providers that ignore it are handled by lenient parsing upstream.
 */
public class OpenAiCompatibleLlmClient implements LlmClient {

    private final RestClient http;
    private final String model;

    /** @param http client with the API base URL and authorization already configured */
    public OpenAiCompatibleLlmClient(RestClient http, String model) {
        this.http = http;
        this.model = model;
    }

    @Override
    public String provider() {
        return AiProperties.OPENAI_COMPATIBLE;
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public LlmResponse complete(LlmRequest request) {
        JsonNode response;
        try {
            response = http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body(request))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE,
                    "Provider " + e.getStatusCode().value() + ": " + describe(e));
        } catch (RestClientException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, "Provider: " + e.getMessage());
        }
        if (response == null) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, "Provider returned an empty response");
        }
        long inputTokens = response.path("usage").path("prompt_tokens").asLong(0);
        long outputTokens = response.path("usage").path("completion_tokens").asLong(0);
        JsonNode choice = response.path("choices").path(0);
        String finishReason = choice.path("finish_reason").asString("");
        JsonNode message = choice.path("message");
        if ("content_filter".equals(finishReason) || !message.path("refusal").asString("").isEmpty()) {
            throw new LlmException(LlmException.Reason.REFUSED, "The model declined the request", inputTokens,
                    outputTokens);
        }
        if ("length".equals(finishReason)) {
            throw new LlmException(LlmException.Reason.TRUNCATED, "The answer reached the token limit", inputTokens,
                    outputTokens);
        }
        String text = message.path("content").asString("");
        if (text.isBlank()) {
            throw new LlmException(LlmException.Reason.INVALID_ANSWER, "The answer is empty", inputTokens,
                    outputTokens);
        }
        return new LlmResponse(text, response.path("model").asString(model), inputTokens, outputTokens);
    }

    private Map<String, Object> body(LlmRequest request) {
        Map<String, Object> jsonSchema = new LinkedHashMap<>();
        jsonSchema.put("name", request.schemaName());
        jsonSchema.put("strict", true);
        jsonSchema.put("schema", request.schema());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", List.of(
                Map.of("role", "system", "content", request.system()),
                Map.of("role", "user", "content", request.prompt())));
        body.put("response_format", Map.of("type", "json_schema", "json_schema", jsonSchema));
        return body;
    }

    private static String describe(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null && body.path("error").has("message")) {
                return body.path("error").path("message").asString();
            }
        } catch (RuntimeException ignored) {
            // not a JSON error body
        }
        return e.getStatusText();
    }
}
