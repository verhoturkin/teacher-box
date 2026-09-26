package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.testing.TestUsers;

/** The administrator sees the AI provider, the request log and checks the connection (ADR-0010). */
@AiIntegrationTest
class AdminAiIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeLlmClient llm;

    @AfterEach
    void reset() {
        llm.reset();
    }

    @Test
    void theAdministratorSeesTheProviderAndTheUsage() {
        assertThat(mvc.get().uri("/api/admin/ai/status").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.provider").isEqualTo("fake");
        assertThat(mvc.get().uri("/api/admin/ai/usage?month=2026-09").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.month").isEqualTo("2026-09");
        assertThat(mvc.get().uri("/api/admin/ai/usage").with(TestUsers.teacher(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void checksTheProviderWithoutSpendingTokens() {
        assertThat(mvc.post().uri("/api/admin/integrations/check").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ (fake)')].state").asArray()
                            .containsExactly("OK");
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ (fake)')].detail").asArray()
                            .containsExactly("Модель fake-model доступна");
                });

        llm.failPing(new LlmException(LlmException.Reason.UNAVAILABLE, "Provider 401: Invalid API key"));
        assertThat(mvc.post().uri("/api/admin/integrations/check").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ (fake)')].state").asArray()
                            .containsExactly("FAILED");
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ (fake)')].detail").asArray()
                            .containsExactly("Provider 401: Invalid API key");
                });
    }
}
