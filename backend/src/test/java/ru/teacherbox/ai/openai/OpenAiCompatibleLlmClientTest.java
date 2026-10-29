package ru.teacherbox.ai.openai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import ru.teacherbox.ai.application.LlmSource;
import ru.teacherbox.ai.application.PdfPicturesTest;
import ru.teacherbox.shared.i18n.Language;

class OpenAiCompatibleLlmClientTest {

    private static final String URL = "http://ollama:11434/v1/chat/completions";
    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "review_draft",
            Map.of("type", "object", "required", List.of("comment")));

    private final RestClient.Builder builder = RestClient.builder().baseUrl("http://ollama:11434/v1");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(builder.build(), "qwen3:14b");

    @Test
    void sendsChatCompletionWithJsonSchema() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.model").value("qwen3:14b"))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[0].content").value("system text"))
                .andExpect(jsonPath("$.messages[1].role").value("user"))
                .andExpect(jsonPath("$.messages[1].content").value("user text"))
                .andExpect(jsonPath("$.response_format.type").value("json_schema"))
                .andExpect(jsonPath("$.response_format.json_schema.name").value("review_draft"))
                .andExpect(jsonPath("$.response_format.json_schema.strict").value(true))
                .andExpect(jsonPath("$.response_format.json_schema.schema.required[0]").value("comment"))
                .andRespond(withSuccess("""
                        {"model": "qwen3:14b-q4", "choices": [{"finish_reason": "stop",
                          "message": {"role": "assistant", "content": "{\\"comment\\": \\"Хорошо\\"}"}}],
                         "usage": {"prompt_tokens": 50, "completion_tokens": 20}}
                        """, MediaType.APPLICATION_JSON));

        LlmResponse response = client.complete(REQUEST);

        assertThat(response).isEqualTo(new LlmResponse("{\"comment\": \"Хорошо\"}", "qwen3:14b-q4", 50, 20));
        assertThat(client.provider()).isEqualTo("openai-compatible");
        assertThat(client.model()).isEqualTo("qwen3:14b");
        server.verify();
    }

    @Test
    void sendsMaterialsAsPicturesWithAPdfDrawnPageByPage() {
        server.expect(requestTo(URL))
                .andExpect(jsonPath("$.messages[1].content[0].text").value("Spotlight 5"))
                .andExpect(jsonPath("$.messages[1].content[1].type").value("image_url"))
                .andExpect(jsonPath("$.messages[1].content[1].image_url.url",
                        org.hamcrest.Matchers.startsWith("data:image/png;base64,iVBOR")))
                .andExpect(jsonPath("$.messages[1].content[2].image_url.url",
                        org.hamcrest.Matchers.startsWith("data:image/png;base64,")))
                .andExpect(jsonPath("$.messages[1].content[3].text").value("Фото"))
                .andExpect(jsonPath("$.messages[1].content[4].image_url.url").value("data:image/jpeg;base64,AQI="))
                .andExpect(jsonPath("$.messages[1].content[5].text").value("Расшифровка видео:\n[0:05] Привет"))
                .andExpect(jsonPath("$.messages[1].content[6].text").value("user text"))
                .andRespond(withSuccess("""
                        {"model": "m", "choices": [{"finish_reason": "stop", "message": {"content": "{}"}}]}
                        """, MediaType.APPLICATION_JSON));

        client.complete(new LlmRequest("system text", "user text", "review_draft", REQUEST.schema(), List.of(
                new LlmSource("Spotlight 5", LlmSource.PDF, PdfPicturesTest.pdf(2)),
                new LlmSource("Фото", "image/jpeg", new byte[] {1, 2}),
                new LlmSource("Расшифровка видео", LlmSource.TEXT,
                        "[0:05] Привет".getBytes(java.nio.charset.StandardCharsets.UTF_8)))));

        server.verify();
    }

    @Test
    void recognizesRefusalsTruncationAndEmptyAnswers() {
        server.expect(requestTo(URL)).andRespond(withSuccess("""
                {"choices": [{"finish_reason": "content_filter", "message": {"content": null}}]}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL)).andRespond(withSuccess("""
                {"choices": [{"finish_reason": "stop", "message": {"content": null, "refusal": "I can't help"}}]}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL)).andRespond(withSuccess("""
                {"choices": [{"finish_reason": "length", "message": {"content": "{\\"comm"}}],
                 "usage": {"prompt_tokens": 50, "completion_tokens": 4000}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL)).andRespond(withSuccess("""
                {"choices": [{"finish_reason": "stop", "message": {"content": "  "}}]}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL)).andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertReason(LlmException.Reason.REFUSED);
        assertReason(LlmException.Reason.REFUSED);
        assertThatThrownBy(() -> client.complete(REQUEST)).isInstanceOfSatisfying(LlmException.class, e -> {
            assertThat(e.reason()).isEqualTo(LlmException.Reason.TRUNCATED);
            assertThat(e.outputTokens()).isEqualTo(4000);
        });
        assertReason(LlmException.Reason.INVALID_ANSWER);
        assertReason(LlmException.Reason.UNAVAILABLE);
    }

    @Test
    void providerErrors() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": {\"message\": \"Incorrect API key\"}}"));
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        server.expect(requestTo(URL)).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertThatThrownBy(() -> client.complete(REQUEST)).hasMessage("Provider 401: Incorrect API key");
        assertThatThrownBy(() -> client.complete(REQUEST)).hasMessageContaining("Provider 502");
        assertThatThrownBy(() -> client.complete(REQUEST)).hasMessageContaining("Connection refused");
    }

    @Test
    void switchesToAJsonObjectWhenTheProviderRejectsTheSchema() {
        server.expect(requestTo(URL))
                .andExpect(jsonPath("$.response_format.type").value("json_schema"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\": {\"message\": \"This response_format type is unavailable now\"}}"));
        for (int i = 0; i < 2; i++) {
            server.expect(requestTo(URL))
                    .andExpect(jsonPath("$.response_format.type").value("json_object"))
                    .andExpect(jsonPath("$.response_format.json_schema").doesNotExist())
                    .andExpect(jsonPath("$.messages[0].content", org.hamcrest.Matchers.allOf(
                            org.hamcrest.Matchers.startsWith(
                                    "system text" + OpenAiCompatibleLlmClient.JSON_OBJECT_INSTRUCTION + "{"),
                            org.hamcrest.Matchers.containsString("\"required\":[\"comment\"]"))))
                    .andRespond(withSuccess("""
                            {"choices": [{"finish_reason": "stop", "message": {"content": "{\\"comment\\": \\"Да\\"}"}}],
                             "usage": {"prompt_tokens": 60, "completion_tokens": 10}}
                            """, MediaType.APPLICATION_JSON));
        }

        assertThat(client.complete(REQUEST).text()).isEqualTo("{\"comment\": \"Да\"}");
        assertThat(client.answerFormat()).isEqualTo(OpenAiCompatibleLlmClient.AnswerFormat.JSON_OBJECT);
        assertThat(client.complete(REQUEST).inputTokens()).isEqualTo(60);
        server.verify();
    }

    @Test
    void otherBadRequestsAreNotRetried() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": {\"message\": \"Model not found\"}}"));
        OpenAiCompatibleLlmClient jsonObject = new OpenAiCompatibleLlmClient(builder.build(), "deepseek",
                "deepseek-flash", OpenAiCompatibleLlmClient.AnswerFormat.JSON_OBJECT, Map.of());

        assertThatThrownBy(() -> client.complete(REQUEST)).hasMessage("Provider 400: Model not found");
        assertThat(client.answerFormat()).isEqualTo(OpenAiCompatibleLlmClient.AnswerFormat.JSON_SCHEMA);
        server.verify();
        server.reset();
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": {\"message\": \"Bad response_format\"}}"));
        assertThatThrownBy(() -> jsonObject.complete(REQUEST)).hasMessage("Provider 400: Bad response_format");
        server.verify();
    }

    @Test
    void configuration() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(PropertiesConfiguration.class, OpenAiCompatibleConfiguration.class)
                .withBean(RestClient.Builder.class, RestClient::builder);

        runner.run(context -> assertThat(context).doesNotHaveBean(OpenAiCompatibleLlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible", "teacherbox.ai.model=gpt")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasRootCauseMessage("TEACHERBOX_AI_BASE_URL is required for the openai-compatible provider"));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible", "teacherbox.ai.base-url=http://x/v1")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasRootCauseMessage("TEACHERBOX_AI_MODEL is required for the openai-compatible provider"));
        runner.withPropertyValues("teacherbox.ai.provider=OpenAI-Compatible", "teacherbox.ai.base-url=http://x/v1/",
                        "teacherbox.ai.model=llama3")
                .run(context -> assertThat(context.getBean(OpenAiCompatibleLlmClient.class).model())
                        .isEqualTo("llama3"));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible", "teacherbox.ai.base-url=http://x/v1",
                        "teacherbox.ai.model=gpt", "teacherbox.ai.api-key=sk-test")
                .run(context -> assertThat(context).hasSingleBean(OpenAiCompatibleLlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible", "teacherbox.ai.base-url=http://x/v1",
                        "teacherbox.ai.model=gpt", "teacherbox.ai.proxy=socks5://vpn:1080")
                .run(context -> assertThat(context).hasSingleBean(OpenAiCompatibleLlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible", "teacherbox.ai.base-url=http://x/v1",
                        "teacherbox.ai.model=gpt", "teacherbox.ai.proxy=ftp://vpn:21")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasMessageContaining("TEACHERBOX_AI_PROXY: Unsupported proxy scheme 'ftp'"));
    }

    @Test
    void sendsBearerKeyWhenConfigured() {
        RestClient.Builder authorized = RestClient.builder().baseUrl("http://ollama:11434/v1")
                .defaultHeader("Authorization", "Bearer sk-test");
        MockRestServiceServer authorizedServer = MockRestServiceServer.bindTo(authorized).build();
        authorizedServer.expect(requestTo(URL))
                .andExpect(header("Authorization", "Bearer sk-test"))
                .andRespond(withSuccess("""
                        {"choices": [{"finish_reason": "stop", "message": {"content": "{}"}}]}
                        """, MediaType.APPLICATION_JSON));

        LlmResponse response = new OpenAiCompatibleLlmClient(authorized.build(), "gpt").complete(REQUEST);

        assertThat(response.model()).as("model falls back to the configured one").isEqualTo("gpt");
        assertThat(response.inputTokens()).isZero();
        authorizedServer.verify();
    }

    @Test
    void pingListsTheModelsWithoutSpendingTokens() {
        String models = "http://ollama:11434/v1/models";
        server.expect(requestTo(models)).andExpect(method(HttpMethod.GET)).andRespond(withSuccess("""
                {"data": [{"id": "llama3.1:8b"}, {"id": "qwen3:14b"}]}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(models)).andRespond(withSuccess("""
                {"data": [{"id": "models/other"}]}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(models)).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("""
                        {"error": {"message": "Invalid API key"}}
                        """));
        server.expect(requestTo(models)).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertThat(client.ping(Language.RU)).isEqualTo("Модель qwen3:14b доступна");
        assertThat(client.ping(Language.EN))
                .isEqualTo("The provider is responding, but qwen3:14b is not in its list of 1 available models.");
        assertThatThrownBy(() -> client.ping(Language.RU)).isInstanceOfSatisfying(LlmException.class,
                e -> assertThat(e.getMessage()).isEqualTo("Provider 401: Invalid API key"));
        assertThatThrownBy(() -> client.ping(Language.RU)).isInstanceOfSatisfying(LlmException.class,
                e -> assertThat(e.reason()).isEqualTo(LlmException.Reason.UNAVAILABLE));
        server.verify();
    }

    @Test
    void pingFindsGeminiModelsByTheirFullName() {
        OpenAiCompatibleLlmClient gemini = new OpenAiCompatibleLlmClient(builder.build(), "gemini", "gemini-3.8-flash");
        server.expect(requestTo("http://ollama:11434/v1/models")).andRespond(withSuccess("""
                {"data": [{"id": "models/gemini-3.8-flash"}]}
                """, MediaType.APPLICATION_JSON));

        assertThat(gemini.ping(Language.RU)).isEqualTo("Модель gemini-3.8-flash доступна");
    }

    private void assertReason(LlmException.Reason reason) {
        assertThatThrownBy(() -> client.complete(REQUEST))
                .isInstanceOfSatisfying(LlmException.class, e -> assertThat(e.reason()).isEqualTo(reason));
    }

    @EnableConfigurationProperties(AiProperties.class)
    static class PropertiesConfiguration {
    }
}
