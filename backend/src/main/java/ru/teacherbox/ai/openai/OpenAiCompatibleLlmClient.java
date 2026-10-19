package ru.teacherbox.ai.openai;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.ai.application.DraftSources;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import ru.teacherbox.ai.application.LlmSource;
import ru.teacherbox.ai.application.PdfPictures;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.http.OutboundProxy;
import ru.teacherbox.shared.i18n.Language;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Any provider with an OpenAI-compatible {@code /chat/completions} endpoint (OpenAI, OpenRouter,
 * Gemini, DeepSeek, Ollama, LM Studio, vLLM, ...). The answer format is requested with a JSON schema
 * {@code response_format}; providers that ignore it are handled by lenient parsing upstream. A provider
 * that rejects the schema format (DeepSeek: «This response_format type is unavailable») is asked for a
 * JSON object with the schema in the system prompt — from the start or after the first rejection.
 */
public class OpenAiCompatibleLlmClient implements LlmClient {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleLlmClient.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    static final String JSON_OBJECT_INSTRUCTION =
            "\n\nAnswer with one JSON object only, valid against this JSON Schema:\n";

    /** How the answer format is requested. */
    public enum AnswerFormat {
        /** {@code response_format: json_schema} — the schema is enforced by the provider. */
        JSON_SCHEMA,
        /** {@code response_format: json_object} — any JSON; the schema goes into the system prompt. */
        JSON_OBJECT
    }

    private final RestClient http;
    private final String provider;
    private final String model;
    private final Map<String, Object> extraBody;
    private volatile AnswerFormat format;

    /** @param http client with the API base URL and authorization already configured */
    public OpenAiCompatibleLlmClient(RestClient http, String model) {
        this(http, AiProperties.OPENAI_COMPATIBLE, model);
    }

    /** @param provider id of the provider for the usage log, e.g. {@code gemini} */
    public OpenAiCompatibleLlmClient(RestClient http, String provider, String model) {
        this(http, provider, model, Map.of());
    }

    /** @param extraBody provider-specific fields added to every {@code /chat/completions} body */
    public OpenAiCompatibleLlmClient(RestClient http, String provider, String model, Map<String, Object> extraBody) {
        this(http, provider, model, AnswerFormat.JSON_SCHEMA, extraBody);
    }

    /** @param format how the answer format is requested at first */
    public OpenAiCompatibleLlmClient(RestClient http, String provider, String model, AnswerFormat format,
            Map<String, Object> extraBody) {
        this.http = http;
        this.provider = provider;
        this.model = model;
        this.format = format;
        this.extraBody = Map.copyOf(extraBody);
    }

    /** The current way of requesting the answer format. */
    public AnswerFormat answerFormat() {
        return format;
    }

    /**
     * Client of a {@code /chat/completions} API: the key as a bearer token, the provider timeout
     * and the AI proxy. Also used for Gemini and OpenRouter, whose APIs are OpenAI-compatible.
     */
    public static RestClient http(RestClient.Builder builder, AiProperties properties, String baseUrl) {
        OutboundProxy proxy = properties.outboundProxy();
        if (proxy != null) {
            log.info("The AI provider is reached through the proxy {}", proxy);
        }
        RestClient.Builder http = builder.clone()
                .baseUrl(baseUrl.strip().replaceAll("/+$", ""))
                .requestFactory(OutboundHttp.requestFactory(CONNECT_TIMEOUT, properties.timeout(), proxy));
        if (AiProperties.hasText(properties.apiKey())) {
            http.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey().strip());
        }
        return http.build();
    }

    @Override
    public String provider() {
        return provider;
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
            if (format == AnswerFormat.JSON_SCHEMA && rejectsSchema(e)) {
                log.warn("The AI provider rejects a JSON schema answer format; asking for a JSON object instead");
                format = AnswerFormat.JSON_OBJECT;
                return complete(request);
            }
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

    /** The list of models ({@code GET /models}): no tokens are spent. */
    @Override
    public String ping(Language language) {
        JsonNode response;
        try {
            response = http.get().uri("/models").retrieve().body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE,
                    "Provider " + e.getStatusCode().value() + ": " + describe(e));
        } catch (RestClientException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, "Provider: " + e.getMessage());
        }
        List<String> ids = response == null ? List.of() : response.path("data").valueStream()
                .map(entry -> entry.path("id").asString(""))
                .toList();
        boolean listed = ids.stream().anyMatch(id -> id.equals(model) || id.endsWith("/" + model));
        return switch (language) {
            case RU -> listed ? "Модель " + model + " доступна"
                    : "Провайдер отвечает, но модели " + model + " нет среди " + ids.size() + " доступных";
            case EN -> listed ? "Model " + model + " is available"
                    : "The provider answers, but the model " + model + " is not among " + ids.size() + " available";
        };
    }

    private Map<String, Object> body(LlmRequest request) {
        String system = request.system();
        Map<String, Object> responseFormat;
        if (format == AnswerFormat.JSON_SCHEMA) {
            Map<String, Object> jsonSchema = new LinkedHashMap<>();
            jsonSchema.put("name", request.schemaName());
            jsonSchema.put("strict", true);
            jsonSchema.put("schema", request.schema());
            responseFormat = Map.of("type", "json_schema", "json_schema", jsonSchema);
        } else {
            system += JSON_OBJECT_INSTRUCTION + JSON.writeValueAsString(request.schema());
            responseFormat = Map.of("type", "json_object");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", List.of(
                Map.of("role", "system", "content", system),
                Map.of("role", "user", "content", userContent(request))));
        body.put("response_format", responseFormat);
        body.putAll(extraBody);
        return body;
    }

    /** A 400 that names {@code response_format}: the provider does not take a JSON schema. */
    private static boolean rejectsSchema(RestClientResponseException e) {
        return e.getStatusCode().value() == 400 && describe(e).toLowerCase(Locale.ROOT).contains("response_format");
    }

    /**
     * The prompt alone, or the materials first as pictures — a PDF drawn page by page, since these APIs do not all
     * read PDF files (ADR-0039) — or as text (a video transcript, ADR-0047), and the prompt after them.
     */
    private static Object userContent(LlmRequest request) {
        if (request.sources().isEmpty()) {
            return request.prompt();
        }
        List<Map<String, Object>> parts = new ArrayList<>();
        for (LlmSource source : request.sources()) {
            if (source.isText()) {
                parts.add(Map.of("type", "text", "text", source.name() + ":\n" + source.text()));
                continue;
            }
            parts.add(Map.of("type", "text", "text", source.name()));
            List<byte[]> pictures = source.isPdf()
                    ? PdfPictures.render(source.content(), DraftSources.MAX_PAGES)
                    : List.of(source.content());
            String type = source.isPdf() ? "image/png" : source.mediaType();
            for (byte[] picture : pictures) {
                parts.add(Map.of("type", "image_url", "image_url",
                        Map.of("url", "data:" + type + ";base64," + Base64.getEncoder().encodeToString(picture))));
            }
        }
        parts.add(Map.of("type", "text", "text", request.prompt()));
        return parts;
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
