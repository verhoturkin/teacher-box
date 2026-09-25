package ru.teacherbox.ai.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.domain.TokenBudget;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.databind.json.JsonMapper;

class AiUnitTest {

    private final PromptTemplates prompts = new PromptTemplates();

    @Test
    void assistantIsOffWithoutProvider() {
        AiUsage usage = mock(AiUsage.class);
        AiAssistant assistant = new AiAssistant(new StaticListableBeanFactory().getBeanProvider(LlmClient.class),
                prompts, usage, JsonMapper.builder().build());

        assertThatThrownBy(() -> assistant.homeworkDraft(new HomeworkBrief("Дроби", null, 3, null)))
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
        AiUsage usage = new AiUsage(repository, new StaticListableBeanFactory().getBeanProvider(LlmClient.class),
                new AiProperties(null, null, null, null, null, true, 16000, java.time.Duration.ofSeconds(1), 0, null),
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
        String prompt = prompts.render("homework-draft.user.v1",
                Map.of("topic", "Дроби $1", "level", "5", "taskCount", "3", "wishes", "—"));

        assertThat(prompt).startsWith("Составь домашнее задание.").contains("Тема: Дроби $1");
        assertThat(prompts.render("review-draft.system.v1", Map.of())).contains("<answer>");
        assertThatThrownBy(() -> prompts.render("homework-draft.user.v1", Map.of("topic", "x")))
                .hasMessageContaining("{{level}}");
        assertThatThrownBy(() -> prompts.render("missing.v1", Map.of()))
                .hasMessageContaining("Prompt not found");
    }

    @Test
    void propertiesNormalizeTheProvider() {
        assertThat(properties(null).providerId()).isEmpty();
        assertThat(properties(" Anthropic ").providerId()).isEqualTo("anthropic");
        assertThat(properties("GEMINI").providerId()).isEqualTo("gemini");
        assertThatThrownBy(() -> properties("gemeni"))
                .hasMessage("TEACHERBOX_AI_PROVIDER must be anthropic, gemini or openai-compatible, got gemeni");
        assertThat(AiProperties.hasText(" ")).isFalse();
        assertThat(AiProperties.hasText("x")).isTrue();
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
                RequestStatus.FAILED, 3, 4, 5, "e".repeat(1500), Instant.now());

        assertThat(request.totalTokens()).isEqualTo(7);
        assertThat(request.error()).hasSize(1000);
        assertThatThrownBy(() -> new AiRequest(UUID.randomUUID(), AiFeature.REVIEW_DRAFT, "a", "m",
                RequestStatus.FAILED, -1, 0, 0, null, Instant.now())).isInstanceOf(IllegalArgumentException.class);
    }

    private static AiProperties properties(String provider) {
        return new AiProperties(provider, null, null, null, null, true, 16000, java.time.Duration.ofSeconds(1), 0, null);
    }
}
