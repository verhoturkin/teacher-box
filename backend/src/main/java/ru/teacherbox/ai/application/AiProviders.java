package ru.teacherbox.ai.application;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Clock;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiSettings;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * The teacher's AI connections, their models and the AI settings (ADR-0057). The key is write-only: views show
 * whether it is set and its last characters. A connection is checked — its list of models asked for, no tokens spent
 * — when it is saved and on request; the last result is kept in memory for the provider's version.
 */
@Service
public class AiProviders {

    /** What the last check of a connection said. */
    public enum State {
        /** Not checked since the portal started or since the connection changed. */
        UNCHECKED,
        OK,
        FAILED
    }

    /**
     * A connection as the teacher gives it.
     *
     * @param name {@code null} or blank — the kind's name
     */
    public record ConnectionInput(ProviderKind kind, @Nullable String name, @Nullable String apiKey,
            @Nullable String baseUrl, @Nullable String proxy) {
    }

    /**
     * A change of a saved connection; its kind stays.
     *
     * @param apiKey    {@code null} or blank — the key stays
     * @param removeKey the key is removed (a local server needs none)
     */
    public record ConnectionChange(String name, @Nullable String apiKey, boolean removeKey, @Nullable String baseUrl,
            @Nullable String proxy, long version) {
    }

    /** @param label {@code null} or blank — the model id */
    public record ModelInput(String modelId, @Nullable String label, @Nullable String effort, boolean fallbacks,
            long maxTokens, Duration timeout) {
    }

    /**
     * A connection for the teacher.
     *
     * @param keyEnding the key's last 4 characters; {@code null} without a key or for a key too short to show any
     * @param address   the API address in use: {@code baseUrl} or the kind's
     */
    public record ProviderView(UUID id, String kind, String name, boolean keySet, @Nullable String keyEnding,
            @Nullable String baseUrl, @Nullable String address, @Nullable String proxy, int position, long version,
            State state, @Nullable String stateDetail, List<ModelView> models) {
    }

    /** @param isDefault the model of a request that names none */
    public record ModelView(UUID id, String modelId, String label, @Nullable String effort, boolean fallbacks,
            long maxTokens, long timeoutSeconds, int position, long version,
            @JsonProperty("default") boolean isDefault) {
    }

    /** A connection for the administrator: kinds and states, never keys, names, addresses or proxies (ADR-0010). */
    public record AdminProviderView(UUID id, String kind, boolean keySet, State state, @Nullable String stateDetail,
            int models) {
    }

    /** @param models the provider's models; empty when it failed or keeps no list */
    public record CheckResult(State state, @Nullable String detail, List<AvailableModel> models) {
    }

    /**
     * A model the provider offers.
     *
     * @param label its display name or the id
     * @param added already among the connection's models
     */
    public record AvailableModel(String modelId, String label, boolean added) {
    }

    public record SettingsView(@Nullable UUID defaultModelId, long monthlyTokenLimit, long version) {
    }

    private record Check(long version, State state, @Nullable String detail) {
    }

    /** Keys up to this length show no ending: four characters would be too much of them. */
    static final int MIN_KEY_TO_SHOW_ENDING = 12;
    private static final int KEY_ENDING = 4;
    private static final Logger log = LoggerFactory.getLogger(AiProviders.class);

    private final ProviderRepository providers;
    private final LlmClients clients;
    private final Clock clock;
    private final Map<UUID, Check> checks = new ConcurrentHashMap<>();

    public AiProviders(ProviderRepository providers, LlmClients clients, Clock clock) {
        this.providers = providers;
        this.clients = clients;
        this.clock = clock;
    }

    /** By position, each with its models. */
    public List<ProviderView> list() {
        UUID defaultModel = providers.settings().defaultModelId();
        return providers.providers().stream().map(provider -> view(provider, defaultModel)).toList();
    }

    public List<AdminProviderView> adminList() {
        return providers.providers().stream().map(provider -> {
            Check check = check(provider);
            return new AdminProviderView(provider.id(), provider.kind().id(), provider.apiKey() != null,
                    check.state(), check.detail(), providers.models(provider.id()).size());
        }).toList();
    }

    /** Checks a connection that is not saved: the dialog's «Проверить». */
    public CheckResult check(ConnectionInput input) {
        AiProvider provider = provider(Ids.newId(), input, 0, 0);
        return probe(provider, Set.of());
    }

    /** Saves a new connection after the others and checks it; it has no models yet. */
    public ProviderView create(ConnectionInput input) {
        int position = providers.providers().stream().mapToInt(AiProvider::position).max().orElse(-1) + 1;
        AiProvider provider = provider(Ids.newId(), input, position, 0);
        providers.insert(provider, clock.instant());
        log.info("AI provider {} of kind {} added", provider.id(), provider.kind().id());
        probe(provider, Set.of());
        return view(provider, providers.settings().defaultModelId());
    }

    /** Saves the change and checks the connection again. */
    public ProviderView update(UUID id, ConnectionChange change) {
        AiProvider saved = find(id);
        String key = change.removeKey() ? null : change.apiKey() == null || change.apiKey().isBlank() ? saved.apiKey()
                : change.apiKey();
        AiProvider changed = providers.update(provider(id,
                new ConnectionInput(saved.kind(), change.name(), key, change.baseUrl(), change.proxy()),
                saved.position(), change.version()), clock.instant());
        probe(changed, Set.of());
        return view(changed, providers.settings().defaultModelId());
    }

    /** Checks the saved connection again. */
    public ProviderView recheck(UUID id) {
        AiProvider provider = find(id);
        probe(provider, Set.of());
        return view(provider, providers.settings().defaultModelId());
    }

    /**
     * Removes the connection with its models.
     *
     * @throws ConflictException while one of its models is the default
     */
    @Transactional
    public void delete(UUID id) {
        AiProvider provider = find(id);
        UUID defaultModel = providers.settings().defaultModelId();
        if (defaultModel != null && providers.models(id).stream().anyMatch(model -> model.id().equals(defaultModel))) {
            throw new ConflictException("ai.provider.holds-default",
                    "The connection holds the default model: pick another one first");
        }
        providers.deleteProvider(provider.id());
        checks.remove(id);
        log.info("AI provider {} removed", id);
    }

    /**
     * The models the provider offers, those the connection has marked.
     *
     * @throws BusinessRuleException if the provider cannot be reached or refuses the key
     */
    public List<AvailableModel> available(UUID providerId) {
        AiProvider provider = find(providerId);
        Set<String> added = new HashSet<>();
        providers.models(providerId).forEach(model -> added.add(model.modelId()));
        CheckResult result = probe(provider, added);
        if (result.state() == State.FAILED) {
            throw new BusinessRuleException("ai.provider.unavailable", String.valueOf(result.detail()));
        }
        return result.models();
    }

    /** Adds a model after the others; with no default model yet it becomes the default one. */
    @Transactional
    public ModelView addModel(UUID providerId, ModelInput input) {
        find(providerId);
        List<AiModel> models = providers.models(providerId);
        requireUnique(models, input.modelId(), null);
        int position = models.stream().mapToInt(AiModel::position).max().orElse(-1) + 1;
        AiModel model = model(Ids.newId(), providerId, input, position, 0);
        providers.insert(model);
        AiSettings settings = providers.settings();
        UUID defaultModel = settings.defaultModelId();
        if (defaultModel == null) {
            providers.saveSettings(model.id(), settings.monthlyTokenLimit(), settings.version());
            defaultModel = model.id();
        }
        return view(model, defaultModel);
    }

    @Transactional
    public ModelView updateModel(UUID providerId, UUID modelId, ModelInput input, long version) {
        AiModel saved = findModel(providerId, modelId);
        requireUnique(providers.models(providerId), input.modelId(), modelId);
        AiModel changed = providers.update(model(modelId, providerId, input, saved.position(), version));
        return view(changed, providers.settings().defaultModelId());
    }

    /** Removes the model; if it was the default one, the AI is off until the teacher picks another. */
    public void deleteModel(UUID providerId, UUID modelId) {
        findModel(providerId, modelId);
        providers.deleteModel(modelId);
    }

    /**
     * Puts the connection's models in the given order.
     *
     * @param ids every model of the connection, each once
     */
    @Transactional
    public ProviderView reorderModels(UUID providerId, List<UUID> ids) {
        AiProvider provider = find(providerId);
        List<AiModel> models = providers.models(providerId);
        Set<UUID> given = new HashSet<>(ids);
        if (given.size() != ids.size() || models.size() != ids.size()
                || !models.stream().allMatch(model -> given.contains(model.id()))) {
            throw new BusinessRuleException("ai.model.order-mismatch", "The order must name every model once");
        }
        for (AiModel model : models) {
            int position = ids.indexOf(model.id());
            if (position != model.position()) {
                providers.update(new AiModel(model.id(), model.providerId(), model.modelId(), model.label(),
                        model.effort(), model.fallbacks(), model.maxTokens(), model.timeout(), position,
                        model.version()));
            }
        }
        return view(provider, providers.settings().defaultModelId());
    }

    public SettingsView settings() {
        AiSettings settings = providers.settings();
        return new SettingsView(settings.defaultModelId(), settings.monthlyTokenLimit(), settings.version());
    }

    /**
     * @param defaultModelId {@code null} — the AI is off
     * @throws NotFoundException if there is no such model
     */
    @Transactional
    public SettingsView saveSettings(@Nullable UUID defaultModelId, long monthlyTokenLimit, long version) {
        if (defaultModelId != null && providers.findModel(defaultModelId).isEmpty()) {
            throw new NotFoundException("ai.model.not-found", "The model is not among the connections");
        }
        AiSettings settings = providers.saveSettings(defaultModelId, monthlyTokenLimit, version);
        return new SettingsView(settings.defaultModelId(), settings.monthlyTokenLimit(), settings.version());
    }

    private CheckResult probe(AiProvider provider, Set<String> added) {
        CheckResult result;
        try {
            List<AvailableModel> models = clients.probe(provider, LlmClient::models).stream()
                    .map(listed -> new AvailableModel(listed.id(),
                            listed.name() == null || listed.name().isBlank() ? AiModel.labelOf(listed.id())
                                    : AiModel.labelOf(listed.name()),
                            added.contains(listed.id())))
                    .toList();
            result = new CheckResult(State.OK, null, models);
        } catch (LlmException e) {
            log.info("AI provider {} did not pass its check", provider.id());
            result = new CheckResult(State.FAILED, String.valueOf(e.getMessage()), List.of());
        }
        checks.put(provider.id(), new Check(provider.version(), result.state(), result.detail()));
        return result;
    }

    private Check check(AiProvider provider) {
        Check check = checks.get(provider.id());
        return check != null && check.version() == provider.version() ? check
                : new Check(provider.version(), State.UNCHECKED, null);
    }

    private ProviderView view(AiProvider provider, @Nullable UUID defaultModel) {
        Check check = check(provider);
        String key = provider.apiKey();
        return new ProviderView(provider.id(), provider.kind().id(), provider.name(), key != null,
                key != null && key.length() >= MIN_KEY_TO_SHOW_ENDING ? key.substring(key.length() - KEY_ENDING) : null,
                provider.baseUrl(), provider.address(), provider.proxy(), provider.position(), provider.version(),
                check.state(), check.detail(),
                providers.models(provider.id()).stream().map(model -> view(model, defaultModel)).toList());
    }

    private static ModelView view(AiModel model, @Nullable UUID defaultModel) {
        return new ModelView(model.id(), model.modelId(), model.label(), model.effort(), model.fallbacks(),
                model.maxTokens(), model.timeout().toSeconds(), model.position(), model.version(),
                model.id().equals(defaultModel));
    }

    /** The provider with what its kind needs: a key, an address; a proxy that can be used. */
    private static AiProvider provider(UUID id, ConnectionInput input, int position, long version) {
        ProviderKind kind = input.kind();
        String name = input.name() == null || input.name().isBlank() ? kind.title() : input.name();
        AiProvider provider = new AiProvider(id, kind, name, input.apiKey(), input.baseUrl(), input.proxy(), position,
                version);
        if (kind.keyRequired() && provider.apiKey() == null) {
            throw new BusinessRuleException("ai.provider.key-required", kind.title() + " needs an API key");
        }
        if (provider.address() == null && kind == ProviderKind.OPENAI_COMPATIBLE) {
            throw new BusinessRuleException("ai.provider.address-required",
                    "An OpenAI-compatible connection needs an API address");
        }
        OutboundProxy.parse(provider.proxy());
        return provider;
    }

    private static AiModel model(UUID id, UUID providerId, ModelInput input, int position, long version) {
        String label = input.label() == null || input.label().isBlank() ? AiModel.labelOf(input.modelId())
                : input.label();
        return new AiModel(id, providerId, input.modelId(), label, input.effort(), input.fallbacks(),
                input.maxTokens(), input.timeout(), position, version);
    }

    private static void requireUnique(List<AiModel> models, String modelId, @Nullable UUID except) {
        String id = modelId.strip();
        if (models.stream().anyMatch(model -> model.modelId().equals(id) && !model.id().equals(except))) {
            throw new ConflictException("ai.model.duplicate", "The connection has this model already");
        }
    }

    private AiProvider find(UUID id) {
        return providers.findProvider(id)
                .orElseThrow(() -> new NotFoundException("ai.provider.not-found", "No such AI connection"));
    }

    private AiModel findModel(UUID providerId, UUID modelId) {
        return providers.findModel(modelId).filter(model -> Objects.equals(model.providerId(), providerId))
                .orElseThrow(() -> new NotFoundException("ai.model.not-found", "No such model of the connection"));
    }
}
