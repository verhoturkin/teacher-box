package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.persistence.AiRequestRepository;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The model of a request (ADR-0057): the one asked for, else the default; usage per model; diagnostics per connection. */
@AiIntegrationTest
class ModelChoiceIntegrationTests {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final UUID SECOND_PROVIDER = UUID.fromString("0190a000-0000-7000-8000-00000000b001");
    private static final UUID SECOND_MODEL = UUID.fromString("0190a000-0000-7000-8000-00000000b002");
    private static final String HOMEWORK = "{\"title\": \"Т\", \"description\": \"О\"}";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeLlmClient llm;

    @Autowired
    FakeProvider fake;

    @Autowired
    ProviderRepository providers;

    @Autowired
    AiRequestRepository requests;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void setUp() {
        llm.reset();
        fake.reset();
        clock.advance(Duration.ofDays(32));
        providers.insert(new AiProvider(SECOND_PROVIDER, ProviderKind.OPENAI_COMPATIBLE, "Second", null,
                "http://second/v1", null, 1, 0), Instant.EPOCH);
        providers.insert(new AiModel(SECOND_MODEL, SECOND_PROVIDER, "second-model", "Second model", null, true,
                16_000, Duration.ofSeconds(30), 0, 0));
    }

    @AfterEach
    void tearDown() {
        llm.reset();
        fake.reset();
    }

    @Test
    void theRequestNamesItsModelOrGetsTheDefault() {
        llm.answer(HOMEWORK, 10, 5);
        llm.answer(HOMEWORK, 20, 5);

        assertThat(post("/api/teacher/ai/homework-draft",
                "{\"prompt\": \"Дроби\", \"modelId\": \"" + SECOND_MODEL + "\"}")).hasStatusOk();
        assertThat(thisMonth()).extracting(AiRequest::modelId).containsExactly(SECOND_MODEL);
        assertThat(post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Дроби\", \"modelId\": null}"))
                .hasStatusOk();

        assertThat(thisMonth()).extracting(AiRequest::modelId).containsExactlyInAnyOrder(FakeProvider.MODEL, SECOND_MODEL);
    }

    @Test
    void everyDraftTakesTheModel() {
        llm.answer("{\"questions\": []}", 1, 1);
        llm.answer("{\"comment\": \"К\", \"grade\": \"\", \"accept\": true}", 1, 1);
        llm.answer("{\"summary\": \"Итоги\"}", 1, 1);
        llm.answer(HOMEWORK, 1, 1);
        String model = ", \"modelId\": \"" + SECOND_MODEL + "\"}";

        post("/api/teacher/ai/quiz-draft", "{\"prompt\": \"Дроби\"" + model);
        assertThat(post("/api/teacher/ai/review-draft", "{\"title\": \"Т\", \"answer\": \"О\"" + model))
                .hasStatusOk();
        assertThat(post("/api/teacher/ai/lesson-summary", "{\"topic\": \"Дроби\"" + model)).hasStatusOk();
        assertThat(mvc.post().uri("/api/teacher/ai/homework-draft").multipart()
                .file(new MockMultipartFile("brief", "", MediaType.APPLICATION_JSON_VALUE,
                        ("{\"prompt\": \"Дроби\"" + model).getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .with(TestUsers.teacher(TEACHER)))
                .hasStatusOk();

        assertThat(thisMonth()).extracting(AiRequest::modelId).containsOnly(SECOND_MODEL).hasSize(4);
    }

    @Test
    void anUnknownOrRemovedModelIsAConflictNamingTheDefault() {
        providers.deleteModel(SECOND_MODEL);
        String model = ", \"modelId\": \"" + SECOND_MODEL + "\"}";

        for (MvcTestResult result : List.of(
                post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Дроби\"" + model),
                post("/api/teacher/ai/quiz-draft", "{\"prompt\": \"Дроби\"" + model),
                post("/api/teacher/ai/review-draft", "{\"title\": \"Т\", \"answer\": \"О\"" + model),
                post("/api/teacher/ai/lesson-summary", "{\"topic\": \"Дроби\"" + model))) {
            assertThat(result).hasStatus(HttpStatus.CONFLICT).bodyJson().satisfies(json -> {
                assertThat(json).extractingPath("$.code").isEqualTo("ai.model.unknown");
                assertThat(json).extractingPath("$.defaultModelId").isEqualTo(FakeProvider.MODEL.toString());
                assertThat(json).extractingPath("$.defaultModel").isEqualTo("Fake model");
            });
        }
        assertThat(llm.lastRequest()).isNull();
        assertThat(thisMonth()).isEmpty();
    }

    @Test
    void anUnknownModelWithoutADefaultNamesNone() {
        providers.saveSettings(null, FakeProvider.LIMIT, providers.settings().version());

        assertThat(post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Д\", \"modelId\": \"" + UUID.randomUUID()
                + "\"}"))
                .hasStatus(HttpStatus.CONFLICT).bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.code").isEqualTo("ai.model.unknown");
                    assertThat(json).doesNotHavePath("$.defaultModelId");
                });
        assertThat(post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Д\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.disabled");
        assertThat(post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Д\", \"modelId\": \"x\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void onlyTheTeacherAsksForAModel() {
        String body = "{\"prompt\": \"Д\", \"modelId\": \"" + SECOND_MODEL + "\"}";
        assertThat(mvc.post().uri("/api/teacher/ai/homework-draft").with(TestUsers.student(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/ai/homework-draft").with(TestUsers.admin(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(llm.lastRequest()).isNull();
    }

    @Test
    void usageTotalsComePerModelUnderOneLimit() {
        llm.answer(HOMEWORK, 100, 50);
        llm.answer(HOMEWORK, 30, 20);
        llm.answer(HOMEWORK, 1, 1);
        post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Д\"}");
        post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Д\", \"modelId\": \"" + SECOND_MODEL + "\"}");
        post("/api/teacher/ai/homework-draft", "{\"prompt\": \"Д\", \"modelId\": \"" + SECOND_MODEL + "\"}");
        // a request of a model removed since and one logged before models had ids
        UUID removed = UUID.randomUUID();
        requests.insert(new AiRequest(UUID.randomUUID(), AiFeature.REVIEW_DRAFT, "anthropic", "claude-old", removed,
                RequestStatus.SUCCEEDED, 7, 3, 10, null, clock.instant()));
        requests.insert(new AiRequest(UUID.randomUUID(), AiFeature.REVIEW_DRAFT, "anthropic", "claude-older", null,
                RequestStatus.SUCCEEDED, 2, 2, 10, null, clock.instant()));

        assertThat(mvc.get().uri("/api/teacher/ai/usage").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.usedTokens").isEqualTo(216);
                    assertThat(json).extractingPath("$.monthlyTokenLimit").isEqualTo(100_000);
                    assertThat(json).extractingPath("$.models.length()").isEqualTo(4);
                    assertThat(json).extractingPath("$.models[0].modelId").isEqualTo(FakeProvider.MODEL.toString());
                    assertThat(json).extractingPath("$.models[0].label").isEqualTo("Fake model");
                    assertThat(json).extractingPath("$.models[0].requests").isEqualTo(1);
                    assertThat(json).extractingPath("$.models[0].inputTokens").isEqualTo(100);
                    assertThat(json).extractingPath("$.models[0].outputTokens").isEqualTo(50);
                    assertThat(json).extractingPath("$.models[0].removed").isEqualTo(false);
                    assertThat(json).extractingPath("$.models[1].label").isEqualTo("Second model");
                    assertThat(json).extractingPath("$.models[1].requests").isEqualTo(2);
                    assertThat(json).extractingPath("$.models[1].inputTokens").isEqualTo(31);
                    assertThat(json).extractingPath("$.models[2].modelId").isEqualTo(removed.toString());
                    assertThat(json).extractingPath("$.models[2].label").isEqualTo("claude-old");
                    assertThat(json).extractingPath("$.models[2].removed").isEqualTo(true);
                    assertThat(json).extractingPath("$.models[3].modelId").isNull();
                    assertThat(json).extractingPath("$.models[3].label").isEqualTo("claude-older");
                    assertThat(json).extractingPath("$.models[3].removed").isEqualTo(true);
                });
        assertThat(mvc.get().uri("/api/admin/ai/usage").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.models.length()").isEqualTo(4);
        assertThat(mvc.get().uri("/api/teacher/ai/usage?month=2020-01").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.models").asArray().isEmpty();
    }

    @Test
    void diagnosticsCheckEveryConnection() {
        UUID empty = UUID.randomUUID();
        providers.insert(new AiProvider(empty, ProviderKind.OPENAI_COMPATIBLE, "Empty", null, "http://empty/v1", null,
                2, 0), Instant.EPOCH);

        assertThat(mvc.post().uri("/api/admin/integrations/check").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.name =~ /ИИ.*/)].name").asArray()
                            .containsExactly("ИИ (fake)", "ИИ (fake, 2)", "ИИ (fake, 3)");
                    assertThat(json).extractingPath("$[?(@.name =~ /ИИ.*/)].state").asArray()
                            .containsExactly("OK", "OK", "OK");
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ (fake, 2)')].detail").asArray()
                            .containsExactly("Модель fake-model доступна");
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ (fake, 3)')].detail").asArray()
                            .containsExactly("Подключение отвечает, моделей в нём пока нет");
                });

        llm.failPing(new ru.teacherbox.ai.application.LlmException(
                ru.teacherbox.ai.application.LlmException.Reason.UNAVAILABLE, "Provider 401"));
        assertThat(mvc.post().uri("/api/admin/integrations/check").header("Accept-Language", "en")
                .with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.name =~ /AI.*/)].state").asArray()
                            .containsExactly("FAILED", "FAILED", "FAILED");
                    assertThat(json).extractingPath("$[?(@.name == 'AI (fake)')].detail").asArray()
                            .containsExactly("Provider 401");
                });
    }

    @Test
    void diagnosticsWithoutConnectionsSayHowToAddOne() {
        providers.providers().forEach(provider -> providers.deleteProvider(provider.id()));

        assertThat(mvc.post().uri("/api/admin/integrations/check").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().extractingPath("$[?(@.name == 'ИИ')].state").asArray().containsExactly("NOT_CONFIGURED");
    }

    private MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    /** Requests logged in the test's month. */
    private List<AiRequest> thisMonth() {
        Instant now = clock.instant();
        return requests.findRecent(now.minus(Duration.ofDays(1)), now.plusSeconds(1), 100);
    }
}
