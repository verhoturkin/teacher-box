package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.testing.TestUsers;

/** The teacher's library of prompts: saved, changed, reused and deleted. */
@AiIntegrationTest
class PromptLibraryIntegrationTests {

    private static final UUID TEACHER = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Test
    void theTeacherKeepsPrompts() throws Exception {
        MvcTestResult created = send(mvc.post().uri("/api/teacher/ai/prompts"),
                "{\"title\":\"  Тест на 10 вопросов \",\"text\":\"Сделай тест на 10 вопросов\"}");
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Тест на 10 вопросов");
            assertThat(json).extractingPath("$.version").isEqualTo(0);
        });
        String id = JsonPath.read(created.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
        send(mvc.post().uri("/api/teacher/ai/prompts"), "{\"title\":\"Перевод\",\"text\":\"Переведи текст\"}");

        assertThat(mvc.get().uri("/api/teacher/ai/prompts").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[*].title").asArray()
                            .containsSubsequence("Перевод", "Тест на 10 вопросов");
                });

        assertThat(send(mvc.put().uri("/api/teacher/ai/prompts/" + id),
                "{\"title\":\"Тест\",\"text\":\"Сделай тест на 5 вопросов\",\"version\":0}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.text").isEqualTo("Сделай тест на 5 вопросов");
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(send(mvc.put().uri("/api/teacher/ai/prompts/" + id),
                "{\"title\":\"Старое\",\"text\":\"x\",\"version\":0}")).hasStatus(HttpStatus.CONFLICT);

        assertThat(mvc.delete().uri("/api/teacher/ai/prompts/" + id).with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri("/api/teacher/ai/prompts/" + id).with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("ai.prompt-not-found");
    }

    @Test
    void promptsAreChecked() {
        assertThat(send(mvc.post().uri("/api/teacher/ai/prompts"), "{\"title\":\" \",\"text\":\"x\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.post().uri("/api/teacher/ai/prompts"),
                "{\"title\":\"x\",\"text\":\"" + "a".repeat(4_001) + "\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.put().uri("/api/teacher/ai/prompts/" + UUID.randomUUID()),
                "{\"title\":\"x\",\"text\":\"y\",\"version\":0}")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void onlyTheTeacherHasALibrary() {
        assertThat(mvc.get().uri("/api/teacher/ai/prompts").with(TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/ai/prompts").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult send(MockMvcTester.MockMvcRequestBuilder request, String body) {
        return request.with(TestUsers.teacher(TEACHER)).contentType(MediaType.APPLICATION_JSON).content(body)
                .exchange();
    }
}
