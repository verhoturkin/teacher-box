package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.persistence.SystemPromptRepository;
import ru.teacherbox.testing.TestUsers;

/** The teacher rewrites the system prompts of the assistant and returns the default ones (ADR-0043). */
@AiIntegrationTest
class SystemPromptsIntegrationTests {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final String URI = "/api/teacher/ai/system-prompts";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeLlmClient llm;

    @Autowired
    SystemPromptRepository prompts;

    @AfterEach
    void reset() {
        llm.reset();
        for (AiFeature feature : AiFeature.values()) {
            prompts.delete(feature);
        }
    }

    @Test
    void defaultPromptsComeFromTheResources() {
        assertThat(mvc.get().uri(URI).with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[*].feature").asArray()
                            .containsExactly("HOMEWORK_DRAFT", "REVIEW_DRAFT");
                    assertThat(json).extractingPath("$[0].text").asString().startsWith("Ты помогаешь репетитору");
                    assertThat(json).extractingPath("$[0].custom").isEqualTo(false);
                    assertThat(json).extractingPath("$[0].version").isEqualTo(0);
                    assertThat(json).extractingPath("$[0].updatedAt").isNull();
                    assertThat(json).extractingPath("$[1].text").asString().contains("<answer>");
                });
    }

    @Test
    void theTeachersPromptGoesToTheModelUntilReset() {
        assertThat(put("HOMEWORK_DRAFT", "{\"text\":\"  Пиши кратко, {{title}} не трогай \",\"version\":0}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.text").isEqualTo("Пиши кратко, {{title}} не трогай");
                    assertThat(json).extractingPath("$.defaultText").asString().startsWith("Ты помогаешь");
                    assertThat(json).extractingPath("$.custom").isEqualTo(true);
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                    assertThat(json).extractingPath("$.updatedAt").isNotNull();
                });
        assertThat(put("HOMEWORK_DRAFT", "{\"text\":\"Второй вариант\",\"version\":1}"))
                .hasStatusOk().bodyJson().extractingPath("$.version").isEqualTo(2);
        assertThat(put("HOMEWORK_DRAFT", "{\"text\":\"Устаревший\",\"version\":1}")).hasStatus(HttpStatus.CONFLICT);
        assertThat(put("REVIEW_DRAFT", "{\"text\":\"Не с нуля\",\"version\":3}")).hasStatus(HttpStatus.CONFLICT);

        llm.answer("{\"title\": \"Т\", \"description\": \"О\"}", 10, 10);
        assertThat(mvc.post().uri("/api/teacher/ai/homework-draft").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\": \"Дроби\"}"))
                .hasStatusOk();
        LlmRequest request = llm.lastRequest();
        assertThat(request).isNotNull();
        assertThat(request.system()).isEqualTo("Второй вариант");

        assertThat(mvc.delete().uri(URI + "/HOMEWORK_DRAFT").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.custom").isEqualTo(false);
                    assertThat(json).extractingPath("$.version").isEqualTo(0);
                    assertThat(json).extractingPath("$.text").asString().startsWith("Ты помогаешь");
                });
        llm.answer("{\"title\": \"Т\", \"description\": \"О\"}", 10, 10);
        mvc.post().uri("/api/teacher/ai/homework-draft").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\": \"Дроби\"}").exchange();
        LlmRequest again = llm.lastRequest();
        assertThat(again).isNotNull();
        assertThat(again.system()).startsWith("Ты помогаешь репетитору готовить домашние задания");
    }

    @Test
    void concurrentSavesConflict() {
        Instant now = Instant.parse("2026-10-13T10:00:00Z");
        prompts.save(AiFeature.REVIEW_DRAFT, "Первый", now, 0);

        assertThatThrownBy(() -> prompts.save(AiFeature.REVIEW_DRAFT, "Второй", now, 0))
                .isInstanceOf(OptimisticLockingFailureException.class);
        assertThatThrownBy(() -> prompts.save(AiFeature.REVIEW_DRAFT, "Третий", now, 5))
                .isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(prompts.find(AiFeature.REVIEW_DRAFT)).get()
                .extracting(SystemPromptRepository.StoredPrompt::text).isEqualTo("Первый");
    }

    @Test
    void promptsAreChecked() {
        assertThat(put("HOMEWORK_DRAFT", "{\"text\":\" \",\"version\":0}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put("HOMEWORK_DRAFT", "{\"text\":\"" + "a".repeat(10_001) + "\",\"version\":0}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put("HOMEWORK_DRAFT", "{\"text\":\"x\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put("UNKNOWN", "{\"text\":\"x\",\"version\":0}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void onlyTheTeacherEditsThePrompts() {
        assertThat(mvc.get().uri(URI).with(TestUsers.student(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(URI).with(TestUsers.admin(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.delete().uri(URI + "/REVIEW_DRAFT").with(TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult put(String feature, String body) {
        return mvc.put().uri(URI + "/" + feature).with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}
