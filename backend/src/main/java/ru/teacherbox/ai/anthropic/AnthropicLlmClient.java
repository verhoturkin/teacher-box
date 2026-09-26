package ru.teacherbox.ai.anthropic;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;

/**
 * Claude through the official Anthropic Java SDK (Messages API). The answer format is enforced
 * with structured outputs. Thinking is not configured explicitly: the default model runs adaptive
 * thinking by default, and older models (if configured) keep working. Declined requests are
 * retried on Anthropic's recommended fallback model when {@code fallbacks} is on.
 */
public class AnthropicLlmClient implements LlmClient, AutoCloseable {

    static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";

    private final AnthropicClient client;
    private final String model;
    private final OutputConfig.@Nullable Effort effort;
    private final boolean fallbacks;
    private final long maxTokens;

    public AnthropicLlmClient(AnthropicClient client, String model, OutputConfig.@Nullable Effort effort,
            boolean fallbacks, long maxTokens) {
        this.client = client;
        this.model = model;
        this.effort = effort;
        this.fallbacks = fallbacks;
        this.maxTokens = maxTokens;
    }

    @Override
    public String provider() {
        return AiProperties.ANTHROPIC;
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public LlmResponse complete(LlmRequest request) {
        Message message;
        try {
            message = client.messages().create(params(request));
        } catch (AnthropicServiceException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE,
                    "Anthropic API " + e.statusCode() + ": " + e.getMessage());
        } catch (AnthropicException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, "Anthropic API: " + e.getMessage());
        }
        long inputTokens = message.usage().inputTokens();
        long outputTokens = message.usage().outputTokens();
        Optional<StopReason> stopReason = message.stopReason();
        // Check the stop reason before reading the content: a refusal may come with no or partial text.
        if (stopReason.filter(StopReason.REFUSAL::equals).isPresent()) {
            throw new LlmException(LlmException.Reason.REFUSED, "The model declined the request", inputTokens,
                    outputTokens);
        }
        if (stopReason.filter(StopReason.MAX_TOKENS::equals).isPresent()) {
            throw new LlmException(LlmException.Reason.TRUNCATED, "The answer reached max_tokens", inputTokens,
                    outputTokens);
        }
        String text = message.content().stream()
                .flatMap(block -> block.text().stream())
                .map(TextBlock::text)
                .collect(Collectors.joining());
        return new LlmResponse(text, message.model().asString(), inputTokens, outputTokens);
    }

    /** The Models API: no tokens are spent. */
    @Override
    public String ping() {
        try {
            return "Модель " + client.models().retrieve(model).displayName() + " доступна";
        } catch (AnthropicServiceException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE,
                    "Anthropic API " + e.statusCode() + ": " + e.getMessage());
        } catch (AnthropicException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, "Anthropic API: " + e.getMessage());
        }
    }

    MessageCreateParams params(LlmRequest request) {
        OutputConfig.Builder output = OutputConfig.builder()
                .format(JsonOutputFormat.builder().schema(schema(request.schema())).build());
        if (effort != null) {
            output.effort(effort);
        }
        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(maxTokens)
                .system(request.system())
                .outputConfig(output.build())
                .addUserMessage(request.prompt());
        if (fallbacks) {
            params.putAdditionalHeader("anthropic-beta", FALLBACK_BETA)
                    .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));
        }
        return params.build();
    }

    private static JsonOutputFormat.Schema schema(Map<String, Object> schema) {
        JsonOutputFormat.Schema.Builder builder = JsonOutputFormat.Schema.builder();
        schema.forEach((key, value) -> builder.putAdditionalProperty(key, JsonValue.from(value)));
        return builder.build();
    }

    @Override
    public void close() {
        client.close();
    }
}
