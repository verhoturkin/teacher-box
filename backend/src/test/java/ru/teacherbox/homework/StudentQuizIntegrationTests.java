package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The student's side of a quiz (ADR-0052): attempts, autosave, submit, reveal rules, no leaks. */
@HomeworkIntegrationTest
class StudentQuizIntegrationTests {

    private static final String O1 = "b1111111-1111-1111-1111-111111111111";
    private static final String O2 = "b2222222-2222-2222-2222-222222222222";
    private static final String P1 = "c1111111-1111-1111-1111-111111111111";
    private static final String P2 = "c2222222-2222-2222-2222-222222222222";

    private static final String QUESTIONS = """
            [{"type":"SINGLE_CHOICE","text":"Столица?","points":2,"explanation":"Потому что Москва",
              "options":[{"id":"%s","text":"Москва"},{"id":"%s","text":"Омск"}],"correct":["%s"]},
             {"type":"SHORT_TEXT","text":"Дерево","accepted":["берёза","birch"]},
             {"type":"MATCHING","text":"Пары","pairs":[{"id":"%s","left":"1","right":"один"},
              {"id":"%s","left":"2","right":"два"}]}]
            """.formatted(O1, O2, O1, P1, P2);

    /** Question ids of the last assignment; the server assigns them (they are unique across assignments). */
    private String q1;
    private String q2;
    private String q3;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void neverShowsTheKeyBeforeTheRevealAndShuffleIsStable() {
        UUID student = directory.addStudent("Ира");
        String task = assign(student, "AFTER_SUBMIT", 1, null);

        String before = body(get(student, task));
        for (String secret : List.of("Потому что Москва", "birch", "\"correct\"", "\"accepted\"")) {
            assertThat(before).doesNotContain(secret);
        }
        String started = body(mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)).exchange());
        assertThat(started).doesNotContain("Потому что Москва").doesNotContain("birch");
        assertThat(JsonPath.<Object>read(started, "$.results")).isNull();
        assertThat(JsonPath.<Boolean>read(started, "$.canStart")).isFalse();
        String attempt = JsonPath.read(started, "$.openAttempt.id");

        // Same order on every reload, and the right column of a matching carries pair ids only.
        assertThat(JsonPath.<Object>read(body(get(student, task)), "$.questions[0].options"))
                .isEqualTo(JsonPath.read(started, "$.questions[0].options"));
        assertThat(JsonPath.<List<String>>read(started, "$.questions[2].right[*].id")).containsExactlyInAnyOrder(P1,
                P2);

        // Autosaved answers come back to their owner, still without any verdict.
        save(student, task, attempt, q1, "{\"ids\":[\"" + O1 + "\"]}").hasStatus(HttpStatus.NO_CONTENT);
        save(student, task, attempt, q1, "{\"ids\":[\"" + O2 + "\"]}").hasStatus(HttpStatus.NO_CONTENT);
        String reloaded = body(get(student, task));
        assertThat(JsonPath.<List<String>>read(reloaded, "$.openAttempt.answers." + q1 + ".ids")).containsExactly(O2);
        assertThat(reloaded).doesNotContain("Потому что Москва");
    }

    @Test
    void scoresTheBestAttemptAndRevealsAfterSubmit() {
        UUID student = directory.addStudent("Петя");
        String task = assign(student, "AFTER_SUBMIT", 2, null);

        String first = start(student, task);
        save(student, task, first, q1, "{\"ids\":[\"" + O2 + "\"]}").hasStatus(HttpStatus.NO_CONTENT);
        save(student, task, first, q2, "{\"text\":\"Birch\"}").hasStatus(HttpStatus.NO_CONTENT);
        assertThat(submit(student, task, first)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.best.scorePoints").isEqualTo(1);
            assertThat(json).extractingPath("$.best.maxPoints").isEqualTo(4);
            assertThat(json).extractingPath("$.canStart").isEqualTo(true);
            assertThat(json).extractingPath("$.attemptsLeft").isEqualTo(1);
        });

        String second = start(student, task);
        save(student, task, second, q1, "{\"ids\":[\"" + O1 + "\"]}").hasStatus(HttpStatus.NO_CONTENT);
        save(student, task, second, q3, "{\"pairs\":{\"" + P1 + "\":\"" + P1 + "\",\"" + P2 + "\":\"" + P2 + "\"}}")
                .hasStatus(HttpStatus.NO_CONTENT);
        // Worse than the first on the short text, better overall: 2 + 1 (matching) = 3 against 1.
        assertThat(submit(student, task, second)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.best.scorePoints").isEqualTo(3);
            assertThat(json).extractingPath("$.attempts").asArray().hasSize(2);
            assertThat(json).extractingPath("$.canStart").isEqualTo(false);
            assertThat(json).extractingPath("$.results[0].question.explanation").isEqualTo("Потому что Москва");
            assertThat(json).extractingPath("$.results[0].correct").isEqualTo(true);
            assertThat(json).extractingPath("$.results[1].correct").isEqualTo(false);
            assertThat(json).extractingPath("$.results[1].question.accepted").asArray().contains("birch");
        });

        mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)).exchange();
        assertThat(mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.quiz-no-attempts-left");
    }

    @Test
    void anOrderLeftAsShownIsTheAnswer() {
        UUID student = directory.addStudent("Не двигал");
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments")
                .with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Порядок\",\"studentIds\":[\"" + student + "\"],\"quizReveal\":\"AFTER_SUBMIT\","
                        + "\"quizAttempts\":1,\"questions\":[{\"type\":\"ORDERING\",\"text\":\"По порядку\","
                        + "\"options\":[{\"text\":\"раз\"},{\"text\":\"два\"},{\"text\":\"три\"}]}]}")
                .exchange();
        String task = JsonPath.read(body(created), "$.tasks[0].taskId");
        List<String> right = JsonPath.read(body(created), "$.questions[0].options[*].id");
        String started = body(mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)).exchange());
        String attempt = JsonPath.read(started, "$.openAttempt.id");
        List<String> shown = JsonPath.read(started, "$.questions[0].options[*].id");

        // Nothing moved: the shuffle may already be the right order, so what the student saw is the answer.
        String submitted = body(submit(student, task, attempt));
        assertThat(JsonPath.<List<String>>read(submitted, "$.results[0].answer.ids")).isEqualTo(shown);
        assertThat(JsonPath.<Boolean>read(submitted, "$.results[0].correct")).isEqualTo(shown.equals(right));
        assertThat(JsonPath.<Integer>read(submitted, "$.best.scorePoints")).isEqualTo(shown.equals(right) ? 1 : 0);
    }

    @Test
    void revealRulesAfterDueAndNever() {
        UUID student = directory.addStudent("Лена");
        String later = assign(student, "AFTER_DUE", 1, clock.instant().plus(Duration.ofHours(2)).toString());
        String never = assign(student, "NEVER", 1, null);

        String laterAttempt = start(student, later);
        String neverAttempt = start(student, never);
        String laterBody = body(submit(student, later, laterAttempt));
        String neverBody = body(submit(student, never, neverAttempt));

        assertThat(JsonPath.<Integer>read(laterBody, "$.best.scorePoints")).isZero();
        assertThat(laterBody).doesNotContain("Потому что Москва").doesNotContain("birch");
        assertThat(JsonPath.<Object>read(laterBody, "$.results")).isNull();
        assertThat(neverBody).doesNotContain("Потому что Москва").doesNotContain("birch");
        assertThat(JsonPath.<Object>read(neverBody, "$.results")).isNull();

        clock.advance(Duration.ofHours(3));
        assertThat(body(get(student, later))).contains("Потому что Москва");
        assertThat(body(get(student, never))).doesNotContain("Потому что Москва");
    }

    @Test
    void quizOnlyHandInSubmitsTheOpenAttemptAndClosesTheQuiz() {
        UUID student = directory.addStudent("Саша");
        String task = assign(student, "AFTER_SUBMIT", 1, clock.instant().minus(Duration.ofHours(1)).toString());

        // Without any attempt there is nothing to hand in.
        assertThat(handIn(student, task)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("submission.empty");

        // An overdue task still takes attempts.
        String attempt = start(student, task);
        save(student, task, attempt, q1, "{\"ids\":[\"" + O1 + "\"]}").hasStatus(HttpStatus.NO_CONTENT);
        assertThat(handIn(student, task)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("SUBMITTED");
            assertThat(json).extractingPath("$.overdue").isEqualTo(false);
            assertThat(json).extractingPath("$.submissions").asArray().isEmpty();
        });
        assertThat(get(student, task)).bodyJson().extractingPath("$.best.scorePoints").isEqualTo(2);

        assertThat(mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.quiz-closed");
        save(student, task, attempt, q1, "{\"ids\":[\"" + O2 + "\"]}").hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void rejectsBadAnswersAndRepeatedSubmit() {
        UUID student = directory.addStudent("Дима");
        String task = assign(student, "AFTER_SUBMIT", 1, null);
        String attempt = start(student, task);

        save(student, task, attempt, q1, "{\"text\":\"Москва\"}").hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.quiz-answer-invalid");
        save(student, task, attempt, UUID.randomUUID().toString(), "{\"text\":\"x\"}")
                .hasStatus(HttpStatus.NOT_FOUND);
        save(student, task, UUID.randomUUID().toString(), q1, "{\"ids\":[]}").hasStatus(HttpStatus.NOT_FOUND);

        // Starting again returns the attempt in progress.
        assertThat(mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.openAttempt.id").isEqualTo(attempt);

        assertThat(submit(student, task, attempt)).hasStatusOk();
        assertThat(submit(student, task, attempt)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.quiz-attempt-closed");
    }

    @Test
    void anotherStudentAndTheTeacherAreTurnedAway() {
        UUID owner = directory.addStudent("Хозяин");
        UUID stranger = directory.addStudent("Чужой");
        String task = assign(owner, "AFTER_SUBMIT", 1, null);
        String attempt = start(owner, task);

        assertThat(get(stranger, task)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        save(stranger, task, attempt, q1, "{\"ids\":[]}").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(submit(stranger, task, attempt)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(quiz(task)).with(TestUsers.teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN);

        // A task without questions has no quiz.
        String plain = JsonPath.read(body(mvc.post().uri("/api/teacher/homework/assignments")
                .with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Обычное\",\"studentIds\":[\"" + owner + "\"]}").exchange()),
                "$.tasks[0].taskId");
        assertThat(get(owner, plain)).hasStatus(HttpStatus.NOT_FOUND);
    }

    private String assign(UUID student, String reveal, int attempts, String dueAt) {
        String due = dueAt == null ? "" : ",\"dueAt\":\"" + dueAt + "\"";
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments")
                .with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Тест\",\"studentIds\":[\"" + student + "\"],\"quizReveal\":\"" + reveal
                        + "\",\"quizAttempts\":" + attempts + due + ",\"questions\":" + QUESTIONS + "}")
                .exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        q1 = JsonPath.read(body(created), "$.questions[0].id");
        q2 = JsonPath.read(body(created), "$.questions[1].id");
        q3 = JsonPath.read(body(created), "$.questions[2].id");
        return JsonPath.read(body(created), "$.tasks[0].taskId");
    }

    private String start(UUID student, String task) {
        MvcTestResult started = mvc.post().uri(quiz(task) + "/attempts").with(TestUsers.student(student)).exchange();
        assertThat(started).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(started), "$.openAttempt.id");
    }

    private MvcTestResult get(UUID student, String task) {
        return mvc.get().uri(quiz(task)).with(TestUsers.student(student)).exchange();
    }

    private MvcTestResult submit(UUID student, String task, String attempt) {
        return mvc.post().uri(quiz(task) + "/attempts/" + attempt + "/submit").with(TestUsers.student(student))
                .exchange();
    }

    private MvcTestResult handIn(UUID student, String task) {
        return mvc.post().uri("/api/me/homework/tasks/" + task + "/submissions").with(TestUsers.student(student))
                .multipart().exchange();
    }

    private SaveResult save(UUID student, String task, String attempt, String question, String json) {
        return new SaveResult(mvc.put().uri(quiz(task) + "/attempts/" + attempt + "/answers/" + question)
                .with(TestUsers.student(student)).contentType(MediaType.APPLICATION_JSON).content(json).exchange());
    }

    /** Lets a call chain read like {@code save(...).hasStatus(...)}. */
    private record SaveResult(MvcTestResult result) {

        SaveResult hasStatus(HttpStatus status) {
            assertThat(result).hasStatus(status);
            return this;
        }

        org.springframework.test.json.AbstractJsonContentAssert<?> bodyJson() {
            return assertThat(result).bodyJson();
        }
    }

    private static String quiz(String task) {
        return "/api/me/homework/tasks/" + task + "/quiz";
    }

    private static String body(MvcTestResult result) {
        return AssignmentIntegrationTests.body(result);
    }
}
