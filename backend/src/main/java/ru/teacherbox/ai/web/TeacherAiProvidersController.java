package ru.teacherbox.ai.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.ai.application.AiProviders;
import ru.teacherbox.ai.application.AiProviders.AvailableModel;
import ru.teacherbox.ai.application.AiProviders.CheckResult;
import ru.teacherbox.ai.application.AiProviders.ConnectionChange;
import ru.teacherbox.ai.application.AiProviders.ConnectionInput;
import ru.teacherbox.ai.application.AiProviders.ModelInput;
import ru.teacherbox.ai.application.AiProviders.ModelView;
import ru.teacherbox.ai.application.AiProviders.ProviderView;
import ru.teacherbox.ai.application.AiProviders.SettingsView;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;

/**
 * The teacher's AI connections, their models, the default model and the monthly limit (ADR-0057). The key is
 * write-only: the views say whether it is set and show its last characters.
 */
@RestController
@RequestMapping("/api/teacher/ai")
class TeacherAiProvidersController {

    private static final String URL = "^https?://\\S+$";
    private static final int MAX_KEY = 1000;
    private static final int MAX_ADDRESS = 500;
    private static final int MAX_TIMEOUT_SECONDS = 600;

    /**
     * @param kind {@code anthropic}, {@code gemini}, {@code openrouter}, {@code deepseek} or
     *             {@code openai-compatible}
     */
    record ConnectionRequest(
            @NotBlank String kind,
            @Size(max = AiProvider.MAX_NAME) @Nullable String name,
            @Size(max = MAX_KEY) @Nullable String apiKey,
            @Size(max = MAX_ADDRESS) @Pattern(regexp = URL) @Nullable String baseUrl,
            @Size(max = MAX_ADDRESS) @Nullable String proxy) {

        ConnectionInput toInput() {
            ProviderKind found = ProviderKind.of(kind)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown connection kind " + kind));
            return new ConnectionInput(found, name, apiKey, baseUrl, proxy);
        }
    }

    /** @param apiKey blank — the key stays; {@code removeKey} removes it */
    record ConnectionChangeRequest(
            @NotBlank @Size(max = AiProvider.MAX_NAME) String name,
            @Size(max = MAX_KEY) @Nullable String apiKey,
            @Nullable Boolean removeKey,
            @Size(max = MAX_ADDRESS) @Pattern(regexp = URL) @Nullable String baseUrl,
            @Size(max = MAX_ADDRESS) @Nullable String proxy,
            @PositiveOrZero long version) {
    }

    /** Defaults: label — the model id, fallbacks on, 16 000 output tokens, 120 s. */
    record ModelRequest(
            @NotBlank @Size(max = AiModel.MAX_MODEL_ID) String modelId,
            @Size(max = AiModel.MAX_LABEL) @Nullable String label,
            @Size(max = 16) @Nullable String effort,
            @Nullable Boolean fallbacks,
            @Positive @Nullable Long maxTokens,
            @Positive @Max(MAX_TIMEOUT_SECONDS) @Nullable Integer timeoutSeconds,
            @PositiveOrZero @Nullable Long version) {

        ModelInput toInput() {
            return new ModelInput(modelId, label, effort, fallbacks == null || fallbacks,
                    maxTokens == null ? AiModel.DEFAULT_MAX_TOKENS : maxTokens,
                    timeoutSeconds == null ? AiModel.DEFAULT_TIMEOUT : Duration.ofSeconds(timeoutSeconds));
        }
    }

    record OrderRequest(@NotEmpty List<@NotNull UUID> ids) {
    }

    /** @param defaultModelId {@code null} — the AI is off */
    record SettingsRequest(@Nullable UUID defaultModelId, @PositiveOrZero long monthlyTokenLimit,
            @PositiveOrZero long version) {
    }

    private final AiProviders providers;

    TeacherAiProvidersController(AiProviders providers) {
        this.providers = providers;
    }

    @GetMapping("/providers")
    List<ProviderView> list() {
        return providers.list();
    }

    /** Checks a connection before it is saved and lists its models; nothing is stored. */
    @PostMapping("/providers/check")
    CheckResult check(@Valid @RequestBody ConnectionRequest request) {
        return providers.check(request.toInput());
    }

    /** Saves the connection and checks it: the answer carries the check's state. */
    @PostMapping("/providers")
    @ResponseStatus(HttpStatus.CREATED)
    ProviderView create(@Valid @RequestBody ConnectionRequest request) {
        return providers.create(request.toInput());
    }

    @PutMapping("/providers/{id}")
    ProviderView update(@PathVariable UUID id, @Valid @RequestBody ConnectionChangeRequest request) {
        return providers.update(id, new ConnectionChange(request.name(), request.apiKey(), Boolean.TRUE.equals(request.removeKey()),
                request.baseUrl(), request.proxy(), request.version()));
    }

    @PostMapping("/providers/{id}/check")
    ProviderView recheck(@PathVariable UUID id) {
        return providers.recheck(id);
    }

    /** Refused (409) while one of its models is the default one. */
    @DeleteMapping("/providers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID id) {
        providers.delete(id);
    }

    /** The provider's own list of models; empty when its API keeps none and the teacher types the id. */
    @GetMapping("/providers/{id}/models/available")
    List<AvailableModel> available(@PathVariable UUID id) {
        return providers.available(id);
    }

    @PostMapping("/providers/{id}/models")
    @ResponseStatus(HttpStatus.CREATED)
    ModelView addModel(@PathVariable UUID id, @Valid @RequestBody ModelRequest request) {
        return providers.addModel(id, request.toInput());
    }

    @PutMapping("/providers/{id}/models/order")
    ProviderView reorder(@PathVariable UUID id, @Valid @RequestBody OrderRequest request) {
        return providers.reorderModels(id, request.ids());
    }

    /** {@code version} is required. */
    @PutMapping("/providers/{id}/models/{modelId}")
    ModelView updateModel(@PathVariable UUID id, @PathVariable UUID modelId,
            @Valid @RequestBody ModelRequest request) {
        if (request.version() == null) {
            throw new IllegalArgumentException("The model's version is required");
        }
        return providers.updateModel(id, modelId, request.toInput(), request.version());
    }

    @DeleteMapping("/providers/{id}/models/{modelId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteModel(@PathVariable UUID id, @PathVariable UUID modelId) {
        providers.deleteModel(id, modelId);
    }

    @GetMapping("/settings")
    SettingsView settings() {
        return providers.settings();
    }

    @PutMapping("/settings")
    SettingsView saveSettings(@Valid @RequestBody SettingsRequest request) {
        return providers.saveSettings(request.defaultModelId(), request.monthlyTokenLimit(), request.version());
    }
}
