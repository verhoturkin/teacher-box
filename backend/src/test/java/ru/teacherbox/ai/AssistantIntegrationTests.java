package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.persistence.AiRequestRepository;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Drafts of homework and reviews through the teacher's API; usage accounting and the monthly limit. */
@AiIntegrationTest
class AssistantIntegrationTests {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final String HOMEWORK_BODY = """
            {"topic": "Дроби", "level": "5 класс", "taskCount": 4, "wishes": "С картинками не надо"}
            """;
    private static final String REVIEW_BODY = """
            {"title": "Дроби", "description": "Сложите 1/2 и 1/3", "answer": "Ответ: 2/5"}
            """;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeLlmClient llm;

    @Autowired
    AiRequestRepository requests;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void setUp() {
        llm.reset();
        // Every test starts in a fresh month, so the monthly totals are its own.
        clock.advance(Duration.ofDays(32));
    }

    @Test
    void draftsHomeworkAndLogsUsage() {
        llm.answer("""
                {"title": "  Сложение дробей  ", "description": "1. Сложите 1/2 и 1/4\\n2. ..."}
                """, 300, 200);

        assertThat(post("/api/teacher/ai/homework-draft", HOMEWORK_BODY))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Сложение дробей");
                    assertThat(json).extractingPath("$.description").asString().startsWith("1. Сложите");
                });

        LlmRequest request = llm.lastRequest();
        assertThat(request).isNotNull();
        assertThat(request.system()).contains("репетитору").contains("Markdown");
        assertThat(request.prompt()).contains("Тема: Дроби", "Уровень ученика: 5 класс", "Количество задач: 4",
                "Пожелания учителя: С картинками не надо");
        assertThat(request.schemaName()).isEqualTo("homework_draft");
        assertThat(request.schema()).containsEntry("additionalProperties", false);
        assertThat(thisMonth()).singleElement().satisfies(logged -> {
            assertThat(logged.feature()).isEqualTo(AiFeature.HOMEWORK_DRAFT);
            assertThat(logged.status()).isEqualTo(RequestStatus.SUCCEEDED);
            assertThat(logged.provider()).isEqualTo("fake");
            assertThat(logged.model()).isEqualTo("fake-model-1");
            assertThat(logged.totalTokens()).isEqualTo(500);
            assertThat(logged.error()).isNull();
        });
    }

    @Test
    void optionalHomeworkFieldsAreDashes() {
        llm.answer("{\"title\": \"Т\", \"description\": \"О\"}", 1, 1);

        assertThat(post("/api/teacher/ai/homework-draft", "{\"topic\": \"Степени\", \"taskCount\": 3}"))
                .hasStatusOk();

        assertThat(llm.lastRequest().prompt()).contains("Уровень ученика: —", "Пожелания учителя: —");
    }

    @Test
    void draftsReviewWithStudentAnswerDelimited() {
        llm.answer("""
                Вот ответ:
                ```json
                {"comment": "Нужно привести к общему знаменателю.", "grade": " 3 ", "accept": false}
                ```
                """, 400, 100);

        assertThat(post("/api/teacher/ai/review-draft", REVIEW_BODY))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.comment").isEqualTo("Нужно привести к общему знаменателю.");
                    assertThat(json).extractingPath("$.grade").isEqualTo("3");
                    assertThat(json).extractingPath("$.accept").isEqualTo(false);
                });
        assertThat(llm.lastRequest().prompt()).contains("<answer>\nОтвет: 2/5\n</answer>", "Сложите 1/2 и 1/3");
        assertThat(thisMonth()).singleElement()
                .satisfies(logged -> assertThat(logged.feature()).isEqualTo(AiFeature.REVIEW_DRAFT));
    }

    @Test
    void emptyGradeBecomesNull() {
        llm.answer("{\"comment\": \"Отлично\", \"grade\": \"\", \"accept\": true}", 1, 1);

        assertThat(post("/api/teacher/ai/review-draft", REVIEW_BODY))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.grade").isNull();
                    assertThat(json).extractingPath("$.accept").isEqualTo(true);
                });
    }

    @Test
    void unusableAnswersAreRejectedButCounted() {
        llm.answer("not json at all", 10, 5);
        llm.answer("{\"title\": \"\", \"description\": \"Текст\"}", 10, 5);
        llm.answer("{\"comment\": \"Хорошо\", \"grade\": \"5\"}", 10, 5);

        assertThat(post("/api/teacher/ai/homework-draft", HOMEWORK_BODY))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.invalid-answer");
        assertThat(post("/api/teacher/ai/homework-draft", HOMEWORK_BODY))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(post("/api/teacher/ai/review-draft", REVIEW_BODY))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);

        assertThat(thisMonth()).hasSize(3).allSatisfy(logged -> {
            assertThat(logged.status()).isEqualTo(RequestStatus.FAILED);
            assertThat(logged.totalTokens()).isEqualTo(15);
        });
    }

    @Test
    void providerFailuresAreExplained() {
        llm.fail(new LlmException(LlmException.Reason.REFUSED, "declined", 0, 0));
        llm.fail(new LlmException(LlmException.Reason.TRUNCATED, "max_tokens", 100, 16000));
        llm.fail(new LlmException(LlmException.Reason.UNAVAILABLE, "Anthropic API 529: Overloaded"));
        llm.fail(new LlmException(LlmException.Reason.INVALID_ANSWER, "empty"));

        assertThat(post("/api/teacher/ai/homework-draft", HOMEWORK_BODY))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.refused");
        assertThat(post("/api/teacher/ai/homework-draft", HOMEWORK_BODY))
                .bodyJson().extractingPath("$.code").isEqualTo("ai.truncated");
        assertThat(post("/api/teacher/ai/review-draft", REVIEW_BODY))
                .bodyJson().extractingPath("$.code").isEqualTo("ai.unavailable");
        assertThat(post("/api/teacher/ai/review-draft", REVIEW_BODY))
                .bodyJson().extractingPath("$.code").isEqualTo("ai.invalid-answer");

        assertThat(thisMonth()).extracting(AiRequest::status).containsExactlyInAnyOrder(
                RequestStatus.REFUSED, RequestStatus.FAILED, RequestStatus.FAILED, RequestStatus.FAILED);
        assertThat(thisMonth()).filteredOn(logged -> logged.status() == RequestStatus.FAILED)
                .extracting(AiRequest::error)
                .contains("Anthropic API 529: Overloaded");
    }

    @Test
    void monthlyLimitStopsNewRequests() {
        llm.answer("{\"title\": \"Много\", \"description\": \"Токенов\"}", 60_000, 40_000);
        assertThat(post("/api/teacher/ai/homework-draft", HOMEWORK_BODY)).hasStatusOk();

        assertThat(mvc.get().uri("/api/teacher/ai/status").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.enabled").isEqualTo(true);
                    assertThat(json).extractingPath("$.provider").isEqualTo("fake");
                    assertThat(json).extractingPath("$.model").isEqualTo("fake-model");
                    assertThat(json).extractingPath("$.usedThisMonth").isEqualTo(100_000);
                    assertThat(json).extractingPath("$.monthlyTokenLimit").isEqualTo(100_000);
                    assertThat(json).extractingPath("$.limitReached").isEqualTo(true);
                });
        llm.reset();
        assertThat(post("/api/teacher/ai/review-draft", REVIEW_BODY))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("ai.limit-exceeded");
        assertThat(llm.lastRequest()).as("the provider was not called").isNull();
        assertThat(thisMonth()).hasSize(1);

        clock.advance(Duration.ofDays(32));
        assertThat(mvc.get().uri("/api/teacher/ai/status").with(TestUsers.teacher(TEACHER)))
                .bodyJson().extractingPath("$.limitReached").isEqualTo(false);
    }

    @Test
    void usageReportByMonth() {
        llm.answer("{\"title\": \"Т\", \"description\": \"О\"}", 100, 50);
        llm.answer("{\"comment\": \"К\", \"grade\": \"4\", \"accept\": true}", 30, 20);
        llm.fail(new LlmException(LlmException.Reason.REFUSED, "declined"));
        post("/api/teacher/ai/homework-draft", HOMEWORK_BODY);
        post("/api/teacher/ai/review-draft", REVIEW_BODY);
        post("/api/teacher/ai/review-draft", REVIEW_BODY);
        String month = YearMonth.from(clock.instant().atZone(ZoneId.of("Europe/Moscow"))).toString();

        assertThat(mvc.get().uri("/api/teacher/ai/usage").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.month").isEqualTo(month);
                    assertThat(json).extractingPath("$.usedTokens").isEqualTo(200);
                    assertThat(json).extractingPath("$.monthlyTokenLimit").isEqualTo(100_000);
                    assertThat(json).extractingPath("$.features[0].feature").isEqualTo("HOMEWORK_DRAFT");
                    assertThat(json).extractingPath("$.features[0].requests").isEqualTo(1);
                    assertThat(json).extractingPath("$.features[1].requests").isEqualTo(2);
                    assertThat(json).extractingPath("$.features[1].inputTokens").isEqualTo(30);
                    assertThat(json).extractingPath("$.recent.length()").isEqualTo(3);
                });
        assertThat(mvc.get().uri("/api/teacher/ai/usage?month=2020-01").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.usedTokens").isEqualTo(0);
                    assertThat(json).extractingPath("$.features[0].requests").isEqualTo(0);
                    assertThat(json).extractingPath("$.recent").asArray().isEmpty();
                });
    }

    @Test
    void validatesRequests() {
        assertThat(post("/api/teacher/ai/homework-draft", "{\"topic\": \" \", \"taskCount\": 3}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("/api/teacher/ai/homework-draft", "{\"topic\": \"Дроби\", \"taskCount\": 50}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("/api/teacher/ai/review-draft", "{\"title\": \"Дроби\", \"answer\": \"\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(llm.lastRequest()).isNull();
    }

    @Test
    void onlyTheTeacherUsesTheAssistant() {
        assertThat(mvc.post().uri("/api/teacher/ai/homework-draft").with(TestUsers.student(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content(HOMEWORK_BODY))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/ai/status")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    /** Requests logged in the test's month. */
    private java.util.List<AiRequest> thisMonth() {
        Instant now = clock.instant();
        return requests.findRecent(now.minus(Duration.ofDays(1)), now.plusSeconds(1), 100);
    }
}
