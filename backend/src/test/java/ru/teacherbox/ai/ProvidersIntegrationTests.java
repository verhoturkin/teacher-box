package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import ru.teacherbox.ai.application.AiSettingsImport;
import ru.teacherbox.ai.application.LlmClients;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiSettings;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.reset.DataReset;
import ru.teacherbox.shared.settings.OldSettings;

/** The providers and models in the {@code ai} schema and the one-time import of the old variables (ADR-0057). */
@AiIntegrationTest
class ProvidersIntegrationTests {

    @Autowired
    ProviderRepository providers;

    @Autowired
    AiSettingsImport settingsImport;

    @Autowired
    LlmClients clients;

    @Autowired
    FakeProvider fake;

    @Autowired
    java.util.List<DataReset> resets;

    @BeforeEach
    void empty() {
        resets.stream().filter(reset -> reset.tables().contains("ai.providers")).forEach(DataReset::erase);
        assertThat(providers.settings()).isEqualTo(AiSettings.NONE);
    }

    @AfterEach
    void restore() {
        fake.install();
    }

    @Test
    void anUpgradedInstanceKeepsItsProviderAsTheDefaultModel() {
        Map<String, String> old = new HashMap<>(Map.of(
                "TEACHERBOX_AI_PROVIDER", " Anthropic ",
                "TEACHERBOX_AI_API_KEY", "sk-ant-test",
                "TEACHERBOX_AI_MODEL", "claude-sonnet-5",
                "TEACHERBOX_AI_EFFORT", "HIGH",
                "TEACHERBOX_AI_FALLBACKS", "false",
                "TEACHERBOX_AI_MAX_TOKENS", "8000",
                "TEACHERBOX_AI_TIMEOUT", "90s",
                "TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", "500000"));

        assertThat(settingsImport.importFrom(new OldSettings(old))).containsExactlyInAnyOrderElementsOf(old.keySet());

        AiProvider provider = providers.providers().getFirst();
        assertThat(provider.kind()).isEqualTo(ProviderKind.ANTHROPIC);
        assertThat(provider.name()).isEqualTo("Anthropic");
        assertThat(provider.apiKey()).isEqualTo("sk-ant-test");
        assertThat(provider.proxy()).as("the administrator's default proxy").isNull();
        AiModel model = providers.models(provider.id()).getFirst();
        assertThat(model.modelId()).isEqualTo("claude-sonnet-5");
        assertThat(model.label()).isEqualTo("claude-sonnet-5");
        assertThat(model.effort()).isEqualTo("high");
        assertThat(model.fallbacks()).isFalse();
        assertThat(model.maxTokens()).isEqualTo(8000);
        assertThat(model.timeout()).isEqualTo(Duration.ofSeconds(90));
        AiSettings settings = providers.settings();
        assertThat(settings.defaultModelId()).isEqualTo(model.id());
        assertThat(settings.monthlyTokenLimit()).isEqualTo(500_000);
        assertThat(clients.forDefault()).get()
                .satisfies(found -> assertThat(found.client().model()).isEqualTo("claude-sonnet-5"));

        assertThat(settingsImport.importFrom(new OldSettings(Map.of("TEACHERBOX_AI_PROVIDER", "gemini",
                "TEACHERBOX_AI_API_KEY", "AIza")))).as("the teacher's providers win").isEmpty();
        assertThat(providers.providers()).hasSize(1);
    }

    @Test
    void theKindsDefaultsFillWhatIsNotSet() {
        assertThat(settingsImport.importFrom(new OldSettings(Map.of("TEACHERBOX_AI_PROVIDER", "gemini",
                "TEACHERBOX_AI_API_KEY", "AIza", "TEACHERBOX_AI_EFFORT", "fast", "TEACHERBOX_AI_MAX_TOKENS", "0"))))
                .containsExactlyInAnyOrder("TEACHERBOX_AI_PROVIDER", "TEACHERBOX_AI_API_KEY",
                        "TEACHERBOX_AI_MAX_TOKENS");

        AiModel model = providers.models(providers.providers().getFirst().id()).getFirst();
        assertThat(model.modelId()).isEqualTo("gemini-3.8-flash");
        assertThat(model.effort()).isNull();
        assertThat(model.fallbacks()).isTrue();
        assertThat(model.maxTokens()).isEqualTo(AiModel.DEFAULT_MAX_TOKENS);
        assertThat(model.timeout()).isEqualTo(AiModel.DEFAULT_TIMEOUT);
        assertThat(providers.settings().monthlyTokenLimit()).isEqualTo(AiSettings.DEFAULT_MONTHLY_TOKEN_LIMIT);
    }

    @Test
    void anIncompleteConfigurationIsLeftOutButTheLimitIsTaken() {
        assertThat(settingsImport.importFrom(new OldSettings(Map.of("TEACHERBOX_AI_PROVIDER", "openai-compatible",
                "TEACHERBOX_AI_MODEL", "gpt", "TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", "0"))))
                .containsExactly("TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT");
        assertThat(providers.providers()).isEmpty();
        assertThat(providers.settings()).isEqualTo(new AiSettings(null, 0, 1));
        assertThat(clients.forDefault()).isEmpty();

        assertThat(settingsImport.importFrom(new OldSettings(Map.of("TEACHERBOX_AI_PROVIDER", "gemeni",
                "TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", "7")))).as("the stored limit wins").isEmpty();
        assertThat(settingsImport.importFrom(new OldSettings(Map.of("TEACHERBOX_AI_PROVIDER", "anthropic"))))
                .as("no key").isEmpty();
        assertThat(settingsImport.importFrom(new OldSettings(Map.of()))).isEmpty();
        assertThat(settingsImport.names()).hasSize(9).doesNotContain("TEACHERBOX_AI_PROXY");

        assertThat(settingsImport.importFrom(new OldSettings(Map.of("TEACHERBOX_AI_PROVIDER", "openai-compatible",
                "TEACHERBOX_AI_BASE_URL", "http://ollama:11434/v1", "TEACHERBOX_AI_MODEL", "qwen3:14b"))))
                .containsExactlyInAnyOrder("TEACHERBOX_AI_PROVIDER", "TEACHERBOX_AI_BASE_URL",
                        "TEACHERBOX_AI_MODEL");
        assertThat(providers.providers().getFirst().apiKey()).isNull();
        assertThat(providers.settings().monthlyTokenLimit()).isZero();
    }

    @Test
    void changesAreVersionedAndAProviderGoesWithItsModels() {
        AiProvider provider = new AiProvider(UUID.randomUUID(), ProviderKind.DEEPSEEK, "DeepSeek", "sk", null, null,
                0, 0);
        providers.insert(provider, Instant.EPOCH);
        AiModel model = AiFixtures.model(provider, "deepseek-flash");
        providers.insert(model);
        providers.saveSettings(model.id(), 10, providers.settings().version());

        AiProvider renamed = providers.update(new AiProvider(provider.id(), provider.kind(), "Мой DeepSeek", "sk2",
                null, "socks5://vpn:1080", 1, 0), Instant.EPOCH);
        assertThat(renamed.version()).isEqualTo(1);
        assertThat(providers.findProvider(provider.id())).contains(renamed);
        assertThatThrownBy(() -> providers.update(provider, Instant.EPOCH))
                .isInstanceOf(OptimisticLockingFailureException.class);

        AiModel relabelled = providers.update(new AiModel(model.id(), provider.id(), "deepseek-pro", "Pro", null,
                false, 100, Duration.ofSeconds(10), 1, 0));
        assertThat(providers.findModel(model.id())).contains(relabelled);
        assertThatThrownBy(() -> providers.update(model)).isInstanceOf(OptimisticLockingFailureException.class);
        assertThatThrownBy(() -> providers.saveSettings(null, 1, 99))
                .isInstanceOf(OptimisticLockingFailureException.class);
        assertThatThrownBy(() -> providers.saveSettings(null, 1, 0))
                .as("the row is there already").isInstanceOf(OptimisticLockingFailureException.class);

        AiModel second = AiFixtures.model(provider, "deepseek-flash");
        providers.insert(second);
        assertThat(providers.deleteModel(second.id())).isTrue();
        assertThat(providers.deleteModel(second.id())).isFalse();

        assertThat(providers.deleteProvider(provider.id())).isTrue();
        assertThat(providers.findModel(model.id())).isEmpty();
        assertThat(providers.settings().defaultModelId()).as("the default model is unset").isNull();
        assertThat(providers.deleteProvider(provider.id())).isFalse();
    }
}
