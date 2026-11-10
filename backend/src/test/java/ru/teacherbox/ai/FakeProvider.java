package ru.teacherbox.ai;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.Ordered;
import ru.teacherbox.ai.application.LlmAdapter;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * The provider of the module tests: an OpenAI-compatible row whose client is the {@link FakeLlmClient}. It goes before
 * the real adapter of that kind, so every OpenAI-compatible provider of the tests answers with the fake.
 */
public final class FakeProvider implements LlmAdapter, Ordered, InitializingBean {

    public static final UUID PROVIDER = UUID.fromString("0190a000-0000-7000-8000-00000000a001");
    public static final UUID MODEL = UUID.fromString("0190a000-0000-7000-8000-00000000a002");
    public static final long LIMIT = 100_000;

    private final FakeLlmClient llm;
    private final ProviderRepository providers;

    public FakeProvider(FakeLlmClient llm, ProviderRepository providers) {
        this.llm = llm;
        this.providers = providers;
    }

    @Override
    public ProviderKind kind() {
        return ProviderKind.OPENAI_COMPATIBLE;
    }

    @Override
    public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
        return llm;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public void afterPropertiesSet() {
        install();
    }

    /** Stores the fake provider as the default one unless it is there. */
    public void install() {
        if (providers.findModel(MODEL).isEmpty()) {
            providers.providers().forEach(provider -> providers.deleteProvider(provider.id()));
            providers.insert(new AiProvider(PROVIDER, ProviderKind.OPENAI_COMPATIBLE, "Fake", null, "http://fake/v1",
                    null, 0, 0), Instant.EPOCH);
            providers.insert(new AiModel(MODEL, PROVIDER, "fake-model", "Fake model", null, true, 16_000,
                    Duration.ofSeconds(30), 0, 0));
        }
        var settings = providers.settings();
        if (!MODEL.equals(settings.defaultModelId()) || settings.monthlyTokenLimit() != LIMIT) {
            providers.saveSettings(MODEL, LIMIT, settings.version());
        }
    }
}
