package ru.teacherbox.ai.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiSettings;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * The {@code TEACHERBOX_AI_*} variables once (ADR-0056, ADR-0057): the configured provider becomes the first
 * provider with one model, the default one, and the monthly limit becomes the teacher's. Nothing is imported
 * while a provider is stored (the teacher's choice wins); an invalid configuration — an unknown kind, a missing
 * key, model or address — is left out. {@code TEACHERBOX_AI_PROXY} stays the administrator's default proxy.
 */
@Component
public class AiSettingsImport implements TeacherSettingsImport {

    static final String PROVIDER = "TEACHERBOX_AI_PROVIDER";
    static final String API_KEY = "TEACHERBOX_AI_API_KEY";
    static final String MODEL = "TEACHERBOX_AI_MODEL";
    static final String BASE_URL = "TEACHERBOX_AI_BASE_URL";
    static final String EFFORT = "TEACHERBOX_AI_EFFORT";
    static final String FALLBACKS = "TEACHERBOX_AI_FALLBACKS";
    static final String MAX_TOKENS = "TEACHERBOX_AI_MAX_TOKENS";
    static final String TIMEOUT = "TEACHERBOX_AI_TIMEOUT";
    static final String LIMIT = "TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT";

    private static final Logger log = LoggerFactory.getLogger(AiSettingsImport.class);

    private final ProviderRepository providers;
    private final Clock clock;

    public AiSettingsImport(ProviderRepository providers, Clock clock) {
        this.providers = providers;
        this.clock = clock;
    }

    @Override
    public Set<String> names() {
        return Set.of(PROVIDER, API_KEY, MODEL, BASE_URL, EFFORT, FALLBACKS, MAX_TOKENS, TIMEOUT, LIMIT);
    }

    @Override
    @Transactional
    public Set<String> importFrom(OldSettings values) {
        if (!providers.providers().isEmpty()) {
            return Set.of();
        }
        Set<String> stored = new TreeSet<>();
        AiSettings settings = providers.settings();
        @Nullable AiModel model = importProvider(values, stored);
        long limit = settings.monthlyTokenLimit();
        if (settings.version() == 0) {
            Optional<Long> imported = values.value(LIMIT, Long.class).filter(value -> value >= 0);
            if (imported.isPresent()) {
                limit = imported.get();
                stored.add(LIMIT);
            }
        }
        if (model != null || stored.contains(LIMIT)) {
            providers.saveSettings(model != null ? model.id() : settings.defaultModelId(), limit, settings.version());
        }
        return stored;
    }

    private @Nullable AiModel importProvider(OldSettings values, Set<String> stored) {
        Optional<ProviderKind> kind = values.text(PROVIDER).flatMap(ProviderKind::of);
        if (kind.isEmpty()) {
            if (values.text(PROVIDER).isPresent()) {
                log.warn("{} names no known AI provider and is not imported", PROVIDER);
            }
            return null;
        }
        String apiKey = values.text(API_KEY).orElse(null);
        String baseUrl = values.text(BASE_URL).orElse(null);
        String modelId = values.text(MODEL).orElse(kind.get().defaultModel());
        if ((kind.get().keyRequired() && apiKey == null) || modelId == null
                || (kind.get() == ProviderKind.OPENAI_COMPATIBLE && baseUrl == null)) {
            log.warn("The AI configuration misses the key, the model or the address and is not imported");
            return null;
        }
        String effort;
        try {
            effort = AiModel.effort(values.text(EFFORT).orElse(null));
        } catch (IllegalArgumentException e) {
            log.warn("{} is not an effort and is not imported", EFFORT);
            effort = null;
        }
        Instant now = clock.instant();
        AiProvider provider = new AiProvider(Ids.newId(), kind.get(), kind.get().title(), apiKey, baseUrl, null, 0, 0);
        AiModel model = new AiModel(Ids.newId(), provider.id(), modelId, AiModel.labelOf(modelId), effort,
                values.value(FALLBACKS, Boolean.class).orElse(true),
                values.value(MAX_TOKENS, Long.class).filter(tokens -> tokens > 0).orElse(AiModel.DEFAULT_MAX_TOKENS),
                values.value(TIMEOUT, Duration.class).filter(timeout -> timeout.toSeconds() > 0)
                        .orElse(AiModel.DEFAULT_TIMEOUT),
                0, 0);
        providers.insert(provider, now);
        providers.insert(model);
        for (String name : Set.of(PROVIDER, API_KEY, MODEL, BASE_URL, FALLBACKS, MAX_TOKENS, TIMEOUT)) {
            if (values.text(name).isPresent()) {
                stored.add(name);
            }
        }
        if (effort != null) {
            stored.add(EFFORT);
        }
        return model;
    }
}
