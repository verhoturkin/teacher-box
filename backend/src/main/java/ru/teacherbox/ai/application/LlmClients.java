package ru.teacherbox.ai.application;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.http.OutboundProxy;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.settings.LiveProperties;

/**
 * The clients of the configured models (ADR-0057). They are kept per provider and built when first asked
 * for; a change of the provider (its version), of the model or of the proxy in force — the provider's own or
 * the administrator's live default — drops them, so the next request builds them anew. A client dropped while
 * a request is running finishes that request; clients still kept are closed when the portal stops.
 */
@Service
public class LlmClients implements DisposableBean {

    /** A model ready for requests: its rows and its client. */
    public record ModelClient(AiProvider provider, AiModel model, LlmClient client) {
    }

    private record Built(long version, LlmClient client) {
    }

    private record ProviderClients(long version, String proxy, ConcurrentMap<UUID, Built> models) {
    }

    private static final Logger log = LoggerFactory.getLogger(LlmClients.class);

    private final ProviderRepository providers;
    private final Map<ProviderKind, LlmAdapter> adapters = new EnumMap<>(ProviderKind.class);
    private final LiveProperties<AiProperties> properties;
    private final ConcurrentMap<UUID, ProviderClients> cache = new ConcurrentHashMap<>();

    public LlmClients(ProviderRepository providers, List<LlmAdapter> adapters, Environment environment) {
        this.providers = providers;
        adapters.forEach(adapter -> this.adapters.putIfAbsent(adapter.kind(), adapter));
        this.properties = new LiveProperties<>(environment, AiProperties.class);
    }

    /** The default model; empty while none is chosen — the AI is off. */
    public Optional<ModelClient> forDefault() {
        UUID model = providers.settings().defaultModelId();
        return model == null ? Optional.empty() : forModel(model);
    }

    /** The model by its id among the configured ones; empty for an unknown or removed one. */
    public Optional<ModelClient> forModel(UUID modelId) {
        return providers.findModel(modelId)
                .flatMap(model -> providers.findProvider(model.providerId())
                        .map(provider -> new ModelClient(provider, model, client(provider, model))));
    }

    private LlmClient client(AiProvider provider, AiModel model) {
        String proxySetting = Objects.requireNonNullElse(
                provider.proxy() != null ? provider.proxy() : properties.get().proxy(), "");
        ProviderClients clients = cache.compute(provider.id(), (id, kept) ->
                kept != null && kept.version() == provider.version() && kept.proxy().equals(proxySetting) ? kept
                        : drop(kept, provider.version(), proxySetting));
        return clients.models().compute(model.id(), (id, kept) ->
                kept != null && kept.version() == model.version() ? kept
                        : new Built(model.version(), build(provider, model, proxySetting))).client();
    }

    private static ProviderClients drop(@Nullable ProviderClients kept, long version, String proxy) {
        if (kept != null) {
            log.info("The AI clients of a provider are built anew after a change");
        }
        return new ProviderClients(version, proxy, new ConcurrentHashMap<>());
    }

    private LlmClient build(AiProvider provider, AiModel model, String proxySetting) {
        ProviderKind kind = provider.kind();
        if (kind.keyRequired() && provider.apiKey() == null) {
            return new Broken(kind, model, "The provider has no API key");
        }
        if (provider.address() == null && kind == ProviderKind.OPENAI_COMPATIBLE) {
            return new Broken(kind, model, "The provider has no API address");
        }
        LlmAdapter adapter = adapters.get(kind);
        if (adapter == null) {
            return new Broken(kind, model, "No adapter for " + kind.id());
        }
        OutboundProxy proxy;
        try {
            proxy = OutboundProxy.parse(proxySetting);
        } catch (IllegalArgumentException e) {
            return new Broken(kind, model, "Proxy: " + e.getMessage());
        }
        if (proxy != null) {
            log.info("The AI provider {} is reached through the proxy {}", provider.id(), proxy);
        }
        return adapter.create(provider, model, proxy);
    }

    @Override
    public void destroy() {
        cache.values().forEach(clients -> clients.models().values().forEach(built -> {
            if (built.client() instanceof AutoCloseable closeable) {
                try {
                    closeable.close();
                } catch (Exception e) {
                    log.debug("An AI client did not close", e);
                }
            }
        }));
        cache.clear();
    }

    /** A provider that cannot be called as it is configured: every call fails with the reason. */
    private record Broken(ProviderKind kind, AiModel configured, String reason) implements LlmClient {

        @Override
        public String provider() {
            return kind.id();
        }

        @Override
        public String model() {
            return configured.modelId();
        }

        @Override
        public LlmResponse complete(LlmRequest request) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, reason);
        }

        @Override
        public String ping(Language language) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, reason);
        }
    }
}
