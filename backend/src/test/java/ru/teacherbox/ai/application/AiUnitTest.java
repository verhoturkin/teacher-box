package ru.teacherbox.ai.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.AiSettings;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.domain.TokenBudget;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.databind.json.JsonMapper;

class AiUnitTest {

    private final PromptTemplates prompts = new PromptTemplates();

    @Test
    void assistantIsOffWithoutProvider() {
        AiUsage usage = mock(AiUsage.class);
        LlmClients clients = mock(LlmClients.class);
        when(clients.forDefault()).thenReturn(java.util.Optional.empty());
        AiAssistant assistant = new AiAssistant(clients, prompts, mock(SystemPrompts.class), usage, mock(DraftSources.class), JsonMapper.builder().build(),
                mock(ru.teacherbox.homework.api.QuizDrafts.class));

        assertThatThrownBy(() -> assistant.homeworkDraft(
                new HomeworkBrief("Дроби", null, java.util.List.of(), java.util.List.of())))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.disabled"));
        assertThatThrownBy(() -> assistant.lessonSummary(
                new AiViews.LessonSummaryBrief("Дроби", "слова", java.util.List.of())))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.disabled"));
        verifyNoInteractions(usage);
    }

    @Test
    void statusWithoutProvider() {
        ru.teacherbox.ai.persistence.AiRequestRepository repository =
                mock(ru.teacherbox.ai.persistence.AiRequestRepository.class);
        when(repository.totalTokens(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(0L);
        LlmClients clients = mock(LlmClients.class);
        when(clients.forDefault()).thenReturn(java.util.Optional.empty());
        ru.teacherbox.ai.persistence.ProviderRepository providers =
                mock(ru.teacherbox.ai.persistence.ProviderRepository.class);
        when(providers.settings()).thenReturn(new ru.teacherbox.ai.domain.AiSettings(null, 0, 1));
        AiUsage usage = new AiUsage(repository, clients, providers,
                new ru.teacherbox.shared.time.InstanceTimeZone(java.time.ZoneId.of("UTC")),
                java.time.Clock.systemUTC());

        assertThat(usage.status()).isEqualTo(new AiViews.AiStatus(false, null, null, 0, 0, false));
    }

    @Test
    void extractsJsonFromChattyAnswers() {
        assertThat(AiAssistant.extractJson("```json\n{\"a\": 1}\n```")).isEqualTo("{\"a\": 1}");
        assertThat(AiAssistant.extractJson("{\"a\": {\"b\": 2}}")).isEqualTo("{\"a\": {\"b\": 2}}");
        assertThat(AiAssistant.extractJson("no json")).isEqualTo("no json");
        assertThat(AiAssistant.extractJson("} {")).isEqualTo("} {");
    }

    @Test
    void rendersVersionedPrompts() {
        String prompt = prompts.render("homework-draft.user.v4",
                Map.of("title", "—", "sources", "—", "prompt", "Дроби $1", "students", ""));

        assertThat(prompt).startsWith("Название, которое уже написал учитель: —").contains("Дроби $1")
                .doesNotContain("students");
        assertThat(prompts.render("review-draft.system.v1", Map.of())).contains("<answer>");
        assertThat(prompts.render("lesson-summary.system.v1", Map.of())).contains("<words>");
        assertThat(prompts.render("lesson-summary.user.v1",
                Map.of("topic", "Дроби", "assignments", "— Задача 1", "words", "решали примеры")))
                .contains("Дроби", "— Задача 1", "<words>\nрешали примеры\n</words>");
        assertThatThrownBy(() -> prompts.render("homework-draft.user.v4", Map.of("sources", "x")))
                .hasMessageContaining("{{students}}");
        assertThatThrownBy(() -> prompts.render("missing.v1", Map.of()))
                .hasMessageContaining("Prompt not found");
    }

    @Test
    void providerKindsByTheirIds() {
        assertThat(ProviderKind.of(null)).isEmpty();
        assertThat(ProviderKind.of(" Anthropic ")).contains(ProviderKind.ANTHROPIC);
        assertThat(ProviderKind.of("GEMINI")).contains(ProviderKind.GEMINI);
        assertThat(ProviderKind.of("OpenAI-Compatible")).contains(ProviderKind.OPENAI_COMPATIBLE);
        assertThat(ProviderKind.of("gemeni")).isEmpty();
        assertThat(ProviderKind.OPENAI_COMPATIBLE.defaultModel()).isNull();
        assertThat(ProviderKind.OPENAI_COMPATIBLE.keyRequired()).isFalse();
        assertThat(ProviderKind.ANTHROPIC.defaultBaseUrl()).isNull();
        assertThat(ProviderKind.ANTHROPIC.title()).isEqualTo("Anthropic");
    }

    @Test
    void providersAndModelsKeepTheirLimits() {
        UUID id = UUID.randomUUID();
        AiProvider provider = new AiProvider(id, ProviderKind.GEMINI, " Gemini ", " ", " http://g/ ", "", 0, 0);
        assertThat(provider.name()).isEqualTo("Gemini");
        assertThat(provider.apiKey()).isNull();
        assertThat(provider.proxy()).isNull();
        assertThat(provider.address()).isEqualTo("http://g/");
        assertThatThrownBy(() -> new AiProvider(id, ProviderKind.GEMINI, " ", null, null, null, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiProvider(id, ProviderKind.GEMINI, "x".repeat(61), null, null, null, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);

        Duration timeout = Duration.ofSeconds(30);
        assertThat(new AiModel(id, id, " m ", " M ", " HIGH ", true, 1, timeout, 0, 0))
                .satisfies(model -> assertThat(model.modelId()).isEqualTo("m"))
                .satisfies(model -> assertThat(model.label()).isEqualTo("M"))
                .satisfies(model -> assertThat(model.effort()).isEqualTo("high"));
        assertThat(AiModel.effort(" ")).isNull();
        assertThatThrownBy(() -> AiModel.effort("fast")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiModel(id, id, "", "M", null, true, 1, timeout, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiModel(id, id, "x".repeat(121), "M", null, true, 1, timeout, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiModel(id, id, "m", " ", null, true, 1, timeout, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiModel(id, id, "m", "x".repeat(61), null, true, 1, timeout, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiModel(id, id, "m", "M", null, true, 0, timeout, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiModel(id, id, "m", "M", null, true, 1, Duration.ZERO, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(AiModel.labelOf(" " + "a".repeat(70))).hasSize(60);
        assertThat(AiModel.labelOf("gpt")).isEqualTo("gpt");
        assertThatThrownBy(() -> new AiSettings(null, -1, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void tokenBudget() {
        assertThat(new TokenBudget(10, 0).isExhausted()).isFalse();
        assertThat(new TokenBudget(10, 0).isUnlimited()).isTrue();
        assertThat(new TokenBudget(9, 10).isExhausted()).isFalse();
        assertThat(new TokenBudget(10, 10).isExhausted()).isTrue();
        assertThatThrownBy(() -> new TokenBudget(-1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TokenBudget(0, -1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requestLogEntry() {
        AiRequest request = new AiRequest(UUID.randomUUID(), AiFeature.REVIEW_DRAFT, "anthropic", "claude-opus-5",
                null, RequestStatus.FAILED, 3, 4, 5, "e".repeat(1500), Instant.now());

        assertThat(request.totalTokens()).isEqualTo(7);
        assertThat(request.error()).hasSize(1000);
        assertThatThrownBy(() -> new AiRequest(UUID.randomUUID(), AiFeature.REVIEW_DRAFT, "a", "m",
                null, RequestStatus.FAILED, -1, 0, 0, null, Instant.now())).isInstanceOf(IllegalArgumentException.class);
    }
}
