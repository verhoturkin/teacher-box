package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.ai.application.LlmClient.Listed;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.testing.TestUsers;

/** The teacher's AI connections and models over REST (ADR-0057); the administrator sees no keys. */
@AiIntegrationTest
class ProvidersApiIntegrationTests {

    private static final String PROVIDERS = "/api/teacher/ai/providers";
    private static final String KEY = "sk-test-0123456789-abcd";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeLlmClient llm;

    @Autowired
    FakeProvider fake;

    @AfterEach
    void reset() {
        llm.reset();
        fake.reset();
    }

    @Test
    void onlyTheTeacherManagesConnections() {
        UUID student = UUID.randomUUID();
        UUID admin = UUID.randomUUID();
        for (RequestPostProcessor user : List.of(TestUsers.student(student), TestUsers.admin(admin))) {
            assertThat(mvc.get().uri(PROVIDERS).with(user)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.post().uri(PROVIDERS).with(user).contentType(MediaType.APPLICATION_JSON)
                    .content(compatible("Local", KEY))).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.post().uri(PROVIDERS + "/check").with(user).contentType(MediaType.APPLICATION_JSON)
                    .content(compatible("Local", KEY))).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.get().uri(PROVIDERS + "/" + FakeProvider.PROVIDER + "/models/available").with(user))
                    .hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.delete().uri(PROVIDERS + "/" + FakeProvider.PROVIDER).with(user))
                    .hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.put().uri("/api/teacher/ai/settings").with(user).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"defaultModelId\":null,\"monthlyTokenLimit\":1,\"version\":1}"))
                    .hasStatus(HttpStatus.FORBIDDEN);
        }
        assertThat(mvc.get().uri("/api/admin/ai/providers").with(TestUsers.teacher(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/admin/ai/providers").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void theKeyIsWriteOnly() throws Exception {
        MvcTestResult created = send(mvc.post().uri(PROVIDERS), """
                {"kind":"openai-compatible","name":" Мой сервер ","apiKey":"%s","baseUrl":"http://fake/v1",
                 "proxy":"socks5://vpn.example:1080"}""".formatted(KEY));
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.name").isEqualTo("Мой сервер");
            assertThat(json).extractingPath("$.kind").isEqualTo("openai-compatible");
            assertThat(json).extractingPath("$.keySet").isEqualTo(true);
            assertThat(json).extractingPath("$.keyEnding").isEqualTo("abcd");
            assertThat(json).extractingPath("$.state").isEqualTo("OK");
            assertThat(json).extractingPath("$.models").asArray().isEmpty();
        });
        assertThat(body(created)).doesNotContain(KEY);
        String id = JsonPath.read(body(created), "$.id");

        MvcTestResult list = mvc.get().uri(PROVIDERS).with(teacher()).exchange();
        assertThat(list).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].name").asArray().containsExactly("Fake", "Мой сервер");
            assertThat(json).extractingPath("$[0].models[0].default").isEqualTo(true);
            assertThat(json).extractingPath("$[1].proxy").isEqualTo("socks5://vpn.example:1080");
        });
        assertThat(body(list)).doesNotContain(KEY);

        MvcTestResult admin = mvc.get().uri("/api/admin/ai/providers").with(TestUsers.admin(UUID.randomUUID()))
                .exchange();
        assertThat(admin).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].kind").asArray()
                    .containsExactly("openai-compatible", "openai-compatible");
            assertThat(json).extractingPath("$[1].state").isEqualTo("OK");
            assertThat(json).extractingPath("$[1].keySet").isEqualTo(true);
            assertThat(json).extractingPath("$[0].models").isEqualTo(1);
        });
        assertThat(body(admin)).doesNotContain(KEY).doesNotContain("abcd").doesNotContain("Мой сервер")
                .doesNotContain("vpn.example");

        assertThat(send(mvc.put().uri(PROVIDERS + "/" + id), """
                {"name":"Сервер","baseUrl":"http://fake/v1","proxy":null,"version":0}"""))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.name").isEqualTo("Сервер");
                    assertThat(json).extractingPath("$.keyEnding").as("no key: kept").isEqualTo("abcd");
                    assertThat(json).extractingPath("$.proxy").isNull();
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(send(mvc.put().uri(PROVIDERS + "/" + id), """
                {"name":"Сервер","apiKey":"new-key-9876","baseUrl":"http://fake/v1","version":1}"""))
                .hasStatusOk().bodyJson().extractingPath("$.keyEnding").isEqualTo("9876");
        assertThat(send(mvc.put().uri(PROVIDERS + "/" + id), """
                {"name":"Сервер","removeKey":true,"baseUrl":"http://fake/v1","version":2}"""))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.keySet").isEqualTo(false);
                    assertThat(json).extractingPath("$.keyEnding").isNull();
                });
        assertThat(send(mvc.put().uri(PROVIDERS + "/" + id), """
                {"name":"Старое","baseUrl":"http://fake/v1","version":0}"""))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(send(mvc.put().uri(PROVIDERS + "/" + UUID.randomUUID()), """
                {"name":"Нет","baseUrl":"http://fake/v1","version":0}"""))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aShortKeyShowsNoEnding() {
        assertThat(send(mvc.post().uri(PROVIDERS), compatible("Local", "abc12345")))
                .hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.keySet").isEqualTo(true);
                    assertThat(json).extractingPath("$.keyEnding").isNull();
                });
    }

    @Test
    void aConnectionIsCheckedBeforeAndWhenItIsSaved() {
        assertThat(send(mvc.post().uri(PROVIDERS + "/check"), compatible(null, null)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.state").isEqualTo("OK");
                    assertThat(json).extractingPath("$.models[*].modelId").asArray()
                            .containsExactly("fake-model", "fake-model-2");
                    assertThat(json).extractingPath("$.models[1].label").isEqualTo("fake-model-2");
                });

        llm.failPing(new LlmException(LlmException.Reason.UNAVAILABLE, "Provider 401: Invalid API key"));
        assertThat(send(mvc.post().uri(PROVIDERS + "/check"), compatible(null, "wrong")))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.state").isEqualTo("FAILED");
                    assertThat(json).extractingPath("$.detail").isEqualTo("Provider 401: Invalid API key");
                    assertThat(json).extractingPath("$.models").asArray().isEmpty();
                });
        MvcTestResult created = send(mvc.post().uri(PROVIDERS), compatible(null, "wrong"));
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.name").as("the kind's name").isEqualTo("OpenAI-compatible");
            assertThat(json).extractingPath("$.state").isEqualTo("FAILED");
            assertThat(json).extractingPath("$.stateDetail").isEqualTo("Provider 401: Invalid API key");
        });
        String id = JsonPath.read(body(created), "$.id");
        assertThat(mvc.get().uri(PROVIDERS + "/" + id + "/models/available").with(teacher()))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.provider.unavailable");

        llm.failPing(null);
        assertThat(mvc.post().uri(PROVIDERS + "/" + id + "/check").with(teacher()))
                .hasStatusOk().bodyJson().extractingPath("$.state").isEqualTo("OK");
        assertThat(mvc.post().uri(PROVIDERS + "/" + UUID.randomUUID() + "/check").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(PROVIDERS).with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$[0].state").as("the fake one is not checked yet").isEqualTo("UNCHECKED");
    }

    @Test
    void aConnectionNeedsWhatItsKindNeeds() {
        assertThat(send(mvc.post().uri(PROVIDERS), "{\"kind\":\"anthropic\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.provider.key-required");
        assertThat(send(mvc.post().uri(PROVIDERS + "/check"), "{\"kind\":\"openai-compatible\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.provider.address-required");
        assertThat(send(mvc.post().uri(PROVIDERS), "{\"kind\":\"gpt\",\"apiKey\":\"k\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.post().uri(PROVIDERS), "{\"kind\":\"deepseek\",\"apiKey\":\"k\",\"proxy\":\"ftp://x\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.post().uri(PROVIDERS), "{\"kind\":\"deepseek\",\"apiKey\":\"k\",\"baseUrl\":\"api\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.post().uri(PROVIDERS), "{\"kind\":\"deepseek\",\"apiKey\":\"k\",\"name\":\"%s\"}"
                .formatted("x".repeat(61)))).hasStatus(HttpStatus.BAD_REQUEST);

        String id = id(send(mvc.post().uri(PROVIDERS), compatible("Local", null)));
        assertThat(send(mvc.put().uri(PROVIDERS + "/" + id), "{\"name\":\"Local\",\"version\":0}"))
                .as("an OpenAI-compatible connection keeps an address")
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.provider.address-required");
    }

    @Test
    void theTeacherPicksModelsOfAConnection() {
        String provider = id(send(mvc.post().uri(PROVIDERS), compatible("Local", KEY)));
        String models = PROVIDERS + "/" + provider + "/models";

        MvcTestResult first = send(mvc.post().uri(models), "{\"modelId\":\" fake-model \"}");
        assertThat(first).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.modelId").isEqualTo("fake-model");
            assertThat(json).extractingPath("$.label").isEqualTo("fake-model");
            assertThat(json).extractingPath("$.fallbacks").isEqualTo(true);
            assertThat(json).extractingPath("$.maxTokens").isEqualTo(16000);
            assertThat(json).extractingPath("$.timeoutSeconds").isEqualTo(120);
            assertThat(json).extractingPath("$.default").isEqualTo(false);
        });
        String firstId = id(first);
        String second = id(send(mvc.post().uri(models), """
                {"modelId":"big","label":"Большая","effort":"HIGH","fallbacks":false,"maxTokens":8000,
                 "timeoutSeconds":60}"""));
        assertThat(send(mvc.post().uri(models), "{\"modelId\":\"big\"}"))
                .hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code").isEqualTo("ai.model.duplicate");
        assertThat(send(mvc.post().uri(models), "{\"modelId\":\"x\",\"effort\":\"fast\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.post().uri(models), "{\"modelId\":\"\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send(mvc.post().uri(PROVIDERS + "/" + UUID.randomUUID() + "/models"), "{\"modelId\":\"x\"}"))
                .hasStatus(HttpStatus.NOT_FOUND);

        assertThat(mvc.get().uri(models + "/available").with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].modelId").asArray().containsExactly("fake-model", "fake-model-2");
            assertThat(json).extractingPath("$[0].label").isEqualTo("Fake model");
            assertThat(json).extractingPath("$[*].added").asArray().containsExactly(true, false);
        });
        llm.listModels(List.of());
        assertThat(mvc.get().uri(models + "/available").with(teacher())).as("no list: the teacher types the id")
                .hasStatusOk().bodyJson().extractingPath("$").asArray().isEmpty();
        llm.listModels(List.of(new Listed("a", null)));

        assertThat(send(mvc.put().uri(models + "/" + second), """
                {"modelId":"big","label":"Самая большая","effort":null,"fallbacks":true,"maxTokens":9000,
                 "timeoutSeconds":90,"version":0}"""))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.label").isEqualTo("Самая большая");
                    assertThat(json).extractingPath("$.effort").isNull();
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(send(mvc.put().uri(models + "/" + second), """
                {"modelId":"fake-model","label":"x","version":1}"""))
                .hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code").isEqualTo("ai.model.duplicate");
        assertThat(send(mvc.put().uri(models + "/" + second), "{\"modelId\":\"big\",\"label\":\"x\",\"version\":0}"))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(send(mvc.put().uri(PROVIDERS + "/" + FakeProvider.PROVIDER + "/models/" + second),
                "{\"modelId\":\"big\",\"label\":\"x\",\"version\":1}"))
                .as("a model of another connection").hasStatus(HttpStatus.NOT_FOUND);

        assertThat(send(mvc.put().uri(models + "/order"), "{\"ids\":[\"%s\",\"%s\"]}".formatted(second, firstId)))
                .hasStatusOk().bodyJson().extractingPath("$.models[*].modelId").asArray()
                .containsExactly("big", "fake-model");
        assertThat(send(mvc.put().uri(models + "/order"), "{\"ids\":[\"%s\"]}".formatted(second)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.model.order-mismatch");

        assertThat(mvc.delete().uri(models + "/" + firstId).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri(models + "/" + firstId).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(PROVIDERS).with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$[1].models[*].label").asArray().containsExactly("Самая большая");
    }

    @Test
    void theDefaultModelAndTheLimitAreTheTeachers() {
        assertThat(mvc.get().uri("/api/teacher/ai/settings").with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.defaultModelId").isEqualTo(FakeProvider.MODEL.toString());
                    assertThat(json).extractingPath("$.monthlyTokenLimit").isEqualTo((int) FakeProvider.LIMIT);
                });
        long version = ((Number) JsonPath.read(body(mvc.get().uri("/api/teacher/ai/settings").with(teacher())
                .exchange()), "$.version")).longValue();

        String provider = id(send(mvc.post().uri(PROVIDERS), compatible("Local", KEY)));
        String model = id(send(mvc.post().uri(PROVIDERS + "/" + provider + "/models"), "{\"modelId\":\"other\"}"));

        assertThat(send(mvc.put().uri("/api/teacher/ai/settings"), """
                {"defaultModelId":"%s","monthlyTokenLimit":5,"version":%d}""".formatted(UUID.randomUUID(), version)))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("ai.model.not-found");
        assertThat(send(mvc.put().uri("/api/teacher/ai/settings"), """
                {"defaultModelId":null,"monthlyTokenLimit":-1,"version":%d}""".formatted(version)))
                .hasStatus(HttpStatus.BAD_REQUEST);

        assertThat(mvc.delete().uri(PROVIDERS + "/" + FakeProvider.PROVIDER).with(teacher()))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.provider.holds-default");

        assertThat(send(mvc.put().uri("/api/teacher/ai/settings"), """
                {"defaultModelId":"%s","monthlyTokenLimit":0,"version":%d}""".formatted(model, version)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.defaultModelId").isEqualTo(model);
                    assertThat(json).extractingPath("$.monthlyTokenLimit").isEqualTo(0);
                });
        assertThat(send(mvc.put().uri("/api/teacher/ai/settings"), """
                {"defaultModelId":null,"monthlyTokenLimit":0,"version":%d}""".formatted(version)))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.get().uri(PROVIDERS).with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$[1].models[0].default").isEqualTo(true);

        assertThat(mvc.delete().uri(PROVIDERS + "/" + provider).with(teacher()))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(send(mvc.put().uri("/api/teacher/ai/settings"), """
                {"defaultModelId":null,"monthlyTokenLimit":0,"version":%d}""".formatted(version + 1)))
                .hasStatusOk().bodyJson().extractingPath("$.defaultModelId").isNull();
        assertThat(mvc.delete().uri(PROVIDERS + "/" + provider).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri(PROVIDERS + "/" + provider).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theFirstModelBecomesTheDefaultWhenThereIsNone() {
        long version = ((Number) JsonPath.read(body(mvc.get().uri("/api/teacher/ai/settings").with(teacher())
                .exchange()), "$.version")).longValue();
        send(mvc.put().uri("/api/teacher/ai/settings"), """
                {"defaultModelId":null,"monthlyTokenLimit":10,"version":%d}""".formatted(version));
        String provider = id(send(mvc.post().uri(PROVIDERS), compatible("Local", KEY)));

        assertThat(send(mvc.post().uri(PROVIDERS + "/" + provider + "/models"), "{\"modelId\":\"m\"}"))
                .hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.default").isEqualTo(true);
        assertThat(mvc.get().uri("/api/teacher/ai/settings").with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$.monthlyTokenLimit").isEqualTo(10);
    }

    private static String compatible(String name, String key) {
        return "{\"kind\":\"openai-compatible\",\"name\":%s,\"apiKey\":%s,\"baseUrl\":\"http://fake/v1\"}"
                .formatted(json(name), json(key));
    }

    private static String json(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    private static RequestPostProcessor teacher() {
        return TestUsers.teacher(UUID.randomUUID());
    }

    private MvcTestResult send(MockMvcTester.MockMvcRequestBuilder request, String body) {
        return request.with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private static String id(MvcTestResult result) {
        return JsonPath.read(body(result), "$.id");
    }

    private static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
