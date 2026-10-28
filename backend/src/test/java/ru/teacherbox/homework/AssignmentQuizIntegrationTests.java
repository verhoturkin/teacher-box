package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.domain.quiz.QuizAttempt;
import ru.teacherbox.homework.persistence.QuizAttemptRepository;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Questions in the teacher's assignment API (ADR-0052). */
@HomeworkIntegrationTest
class AssignmentQuizIntegrationTests {

    private static final String A = "11111111-1111-1111-1111-111111111111";
    private static final String B = "22222222-2222-2222-2222-222222222222";
    private static final String P1 = "33333333-3333-3333-3333-333333333333";

    private static final String QUESTIONS = """
            [{"type":"SINGLE_CHOICE","text":"Столица?","points":2,"explanation":"Потому что",
              "options":[{"id":"%1$s","text":"Москва"},{"id":"%2$s","text":"Омск"}],"correct":["%1$s"]},
             {"type":"MULTIPLE_CHOICE","text":"Чётные","options":[{"id":"%1$s","text":"2"},{"id":"%2$s","text":"3"}],
              "correct":["%1$s"]},
             {"type":"SHORT_TEXT","text":"Берёза","accepted":["берёза","birch"]},
             {"type":"NUMBER","text":"Пи","value":3.14,"tolerance":0.01},
             {"type":"MATCHING","text":"Пары","pairs":[{"id":"%3$s","left":"1","right":"один"},
              {"left":"2","right":"два"}]},
             {"type":"ORDERING","text":"Порядок","options":[{"text":"раз"},{"text":"два"}]}]
            """.formatted(A, B, P1);

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    QuizAttemptRepository attempts;

    @Test
    void savesQuestionsWithSettingsAndShowsTheKeyToTheTeacher() {
        MvcTestResult created = post("/api/teacher/homework/assignments", """
                {"title":"Тест","questions":%s,"quizReveal":"AFTER_DUE","quizAttempts":3}
                """.formatted(QUESTIONS));

        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.quizReveal").isEqualTo("AFTER_DUE");
            assertThat(json).extractingPath("$.quizAttempts").isEqualTo(3);
            assertThat(json).extractingPath("$.questions[*].type").asArray().containsExactly("SINGLE_CHOICE",
                    "MULTIPLE_CHOICE", "SHORT_TEXT", "NUMBER", "MATCHING", "ORDERING");
            assertThat(json).extractingPath("$.questions[0].correct").asArray().containsExactly(A);
            assertThat(json).extractingPath("$.questions[0].points").isEqualTo(2);
            assertThat(json).extractingPath("$.questions[1].points").isEqualTo(1);
            assertThat(json).extractingPath("$.questions[2].accepted").asArray().containsExactly("берёза", "birch");
            assertThat(json).extractingPath("$.questions[3].value").isEqualTo(3.14);
            assertThat(json).extractingPath("$.questions[4].pairs[0].id").isEqualTo(P1);
            assertThat(json).extractingPath("$.questions[5].options[*].text").asArray().containsExactly("раз", "два");
            assertThat(json).extractingPath("$.questions[5].options[0].id").isNotNull();
        });
        String id = JsonPath.read(AssignmentIntegrationTests.body(created), "$.id");

        // Without «questions» an update keeps them and the settings; a list replaces the questions.
        assertThat(put(id, "{\"title\":\"Тест 2\",\"version\":0}")).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.questions").asArray().hasSize(6);
            assertThat(json).extractingPath("$.quizReveal").isEqualTo("AFTER_DUE");
        });
        assertThat(put(id, "{\"title\":\"Тест 3\",\"version\":1,\"quizAttempts\":0,\"questions\":[]}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.questions").asArray().isEmpty();
                    assertThat(json).extractingPath("$.quizAttempts").isNull();
                });

        // A plain assignment keeps the defaults.
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"Обычное\"}")).hasStatus(HttpStatus.CREATED)
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.quizReveal").isEqualTo("AFTER_SUBMIT");
                    assertThat(json).extractingPath("$.quizAttempts").isEqualTo(1);
                });
    }

    @Test
    void copiesQuestionsWithNewIds() {
        String id = JsonPath.read(AssignmentIntegrationTests.body(
                post("/api/teacher/homework/assignments",
                        "{\"title\":\"Оригинал\",\"questions\":" + QUESTIONS + "}")), "$.id");
        String originalQuestion = JsonPath.read(AssignmentIntegrationTests.body(get(id)), "$.questions[0].id");

        assertThat(mvc.post().uri("/api/teacher/homework/assignments/" + id + "/copy").with(teacher()).exchange())
                .hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.questions").asArray().hasSize(6);
                    assertThat(json).extractingPath("$.questions[0].id").isNotEqualTo(originalQuestion);
                });
    }

    @Test
    void rejectsInvalidQuestionsWithCodes() {
        expect("[{\"type\":\"SINGLE_CHOICE\",\"text\":\"\",\"options\":[{\"text\":\"a\"},{\"text\":\"b\"}],"
                + "\"correct\":[\"" + A + "\"]}]", "homework.quiz-text-invalid");
        expect("[{\"type\":\"SINGLE_CHOICE\",\"text\":\"Q\",\"options\":[{\"id\":\"" + A + "\",\"text\":\"a\"},"
                + "{\"text\":\"b\"}],\"correct\":[\"" + B + "\"]}]", "homework.quiz-no-correct");
        expect("[{\"type\":\"SINGLE_CHOICE\",\"text\":\"Q\",\"options\":[{\"text\":\"a\"},{\"text\":\"b\"}]}]",
                "homework.quiz-no-correct");
        expect("[{\"type\":\"SHORT_TEXT\",\"text\":\"Q\",\"points\":0,\"accepted\":[\"a\"]}]",
                "homework.quiz-points-invalid");
        expect("[{\"type\":\"ORDERING\",\"text\":\"Q\",\"options\":[{\"text\":\"a\"}]}]", "homework.quiz-options-count");
        expect("[{\"type\":\"NUMBER\",\"text\":\"Q\"}]", "homework.quiz-value-missing");
        expect("[{\"type\":\"NUMBER\",\"text\":\"Q\",\"value\":1,\"tolerance\":-1}]", "homework.quiz-tolerance-invalid");
        expect("[{\"id\":\"" + A + "\",\"type\":\"SHORT_TEXT\",\"text\":\"R\",\"accepted\":[\"a\"]},"
                + "{\"id\":\"" + A + "\",\"type\":\"SHORT_TEXT\",\"text\":\"S\",\"accepted\":[\"a\"]}]",
                "homework.quiz-duplicate-id");
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"x\",\"quizAttempts\":99}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.quiz-attempts-invalid");
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"x\",\"quizReveal\":\"SOMETIMES\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void freezesQuestionsOnceAStudentStartedButKeepsTheRest() {
        UUID student = directory.addStudent("Кира");
        MvcTestResult created = post("/api/teacher/homework/assignments", "{\"title\":\"Тест\",\"studentIds\":[\""
                + student + "\"],\"questions\":[{\"id\":\"" + A
                + "\",\"type\":\"SHORT_TEXT\",\"text\":\"Q\",\"accepted\":[\"a\"]}]}");
        String id = JsonPath.read(AssignmentIntegrationTests.body(created), "$.id");
        UUID task = UUID.fromString(JsonPath.read(AssignmentIntegrationTests.body(created), "$.tasks[0].taskId"));
        attempts.insert(new QuizAttempt(UUID.randomUUID(), task, Instant.now(), null, null, null));

        assertThat(put(id, "{\"title\":\"x\",\"version\":0,\"questions\":[{\"type\":\"SHORT_TEXT\",\"text\":\"New\","
                + "\"accepted\":[\"b\"]}]}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.quiz-started");
        // The same list, the text and the settings stay editable.
        assertThat(put(id, "{\"title\":\"Новое имя\",\"version\":0,\"quizReveal\":\"NEVER\",\"questions\":["
                + "{\"id\":\"" + A + "\",\"type\":\"SHORT_TEXT\",\"text\":\"Q\",\"accepted\":[\"a\"]}]}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Новое имя");
                    assertThat(json).extractingPath("$.quizReveal").isEqualTo("NEVER");
                });

        // An assignment with attempts can still be deleted.
        assertThat(mvc.delete().uri("/api/teacher/homework/assignments/" + id).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
    }

    @Test
    void studentCannotWriteQuestions() {
        UUID student = directory.addStudent("Любопытный");

        assertThat(mvc.post().uri("/api/teacher/homework/assignments").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"x\",\"questions\":" + QUESTIONS + "}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri("/api/teacher/homework/assignments/" + UUID.randomUUID())
                .with(TestUsers.student(student)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\",\"version\":0,\"questions\":[]}")).hasStatus(HttpStatus.FORBIDDEN);
    }

    private void expect(String questions, String code) {
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"x\",\"questions\":" + questions + "}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code").isEqualTo(code);
    }

    private MvcTestResult get(String id) {
        return mvc.get().uri("/api/teacher/homework/assignments/" + id).with(teacher()).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String id, String json) {
        return mvc.put().uri("/api/teacher/homework/assignments/" + id).with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }
}
