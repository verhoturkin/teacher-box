package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The quiz in the teacher's review (ADR-0052): result, «N из M», override, per-question stats. */
@HomeworkIntegrationTest
class QuizReviewIntegrationTests {

    private static final String O1 = "b1111111-1111-1111-1111-111111111111";
    private static final String O2 = "b2222222-2222-2222-2222-222222222222";

    private static final String QUESTIONS = """
            [{"type":"SINGLE_CHOICE","text":"Столица?","points":2,
              "options":[{"id":"%s","text":"Москва"},{"id":"%s","text":"Омск"}],"correct":["%s"]},
             {"type":"SHORT_TEXT","text":"Дерево","accepted":["берёза"]}]
            """.formatted(O1, O2, O1);

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void reviewShowsTheBestAttemptSuggestsTheGradeAndTakesOverrides() {
        UUID ira = directory.addStudent("Ира");
        UUID petya = directory.addStudent("Петя");
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments")
                .with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Тест\",\"studentIds\":[\"" + ira + "\",\"" + petya + "\"],\"questions\":"
                        + QUESTIONS + "}")
                .exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        String assignment = JsonPath.read(body(created), "$.id");
        String q1 = JsonPath.read(body(created), "$.questions[0].id");
        String q2 = JsonPath.read(body(created), "$.questions[1].id");
        String iraTask = taskOf(created, ira);
        String petyaTask = taskOf(created, petya);

        assertThat(review(iraTask)).bodyJson().extractingPath("$.quiz.suggestedGrade").isNull();

        play(ira, iraTask, "{\"ids\":[\"" + O1 + "\"]}", "{\"text\":\"дуб\"}");
        play(petya, petyaTask, "{\"ids\":[\"" + O2 + "\"]}", "{\"text\":\"берёзка\"}");

        assertThat(review(iraTask)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.quiz.suggestedGrade").isEqualTo("2 из 3");
            assertThat(json).extractingPath("$.quiz.results[0].correct").isEqualTo(true);
            assertThat(json).extractingPath("$.quiz.results[0].question.correct").asArray().contains(O1);
            assertThat(json).extractingPath("$.quiz.results[1].answer.text").isEqualTo("дуб");
        });

        // «берёзка» for «берёза» is a variant the teacher forgives.
        assertThat(override(petyaTask, q2, true)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.quiz.best.scorePoints").isEqualTo(1);
            assertThat(json).extractingPath("$.quiz.suggestedGrade").isEqualTo("1 из 3");
            assertThat(json).extractingPath("$.quiz.results[1].overridden").isEqualTo(true);
        });
        assertThat(override(petyaTask, q2, false)).bodyJson().extractingPath("$.quiz.best.scorePoints")
                .isEqualTo(0);

        assertThat(override(petyaTask, UUID.randomUUID().toString(), true)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.put().uri(quiz(petyaTask, q1)).with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON).content("{}").exchange())
                .hasStatus(HttpStatus.BAD_REQUEST);

        // Ira got the text wrong, Petya the choice (the text override was withdrawn): 2 and 2 wrong.
        assertThat(mvc.get().uri("/api/teacher/homework/assignments/" + assignment + "/quiz/stats")
                .with(TestUsers.teacher(directory.teacherId())).exchange()).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.students").isEqualTo(2);
                    assertThat(json).extractingPath("$.questions[0].wrong").isEqualTo(1);
                    assertThat(json).extractingPath("$.questions[1].wrong").isEqualTo(2);
                });
        assertThat(mvc.get().uri("/api/teacher/homework/assignments/" + UUID.randomUUID() + "/quiz/stats")
                .with(TestUsers.teacher(directory.teacherId())).exchange()).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void studentsNeverGetTheQuizReviewOrTheTeacherEndpoints() {
        UUID student = directory.addStudent("Лена");
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments")
                .with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Тест\",\"studentIds\":[\"" + student + "\"],\"questions\":" + QUESTIONS + "}")
                .exchange();
        String task = taskOf(created, student);
        String q1 = JsonPath.read(body(created), "$.questions[0].id");
        String assignment = JsonPath.read(body(created), "$.id");
        play(student, task, "{\"ids\":[\"" + O1 + "\"]}", "{\"text\":\"x\"}");

        assertThat(mvc.get().uri("/api/me/homework/tasks/" + task).with(TestUsers.student(student)).exchange())
                .hasStatusOk().bodyJson().extractingPath("$.quiz").isNull();
        assertThat(mvc.put().uri(quiz(task, q1)).with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"correct\":true}").exchange())
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/homework/assignments/" + assignment + "/quiz/stats")
                .with(TestUsers.student(student)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
    }

    private void play(UUID student, String task, String first, String second) {
        String base = "/api/me/homework/tasks/" + task + "/quiz";
        String attempt = JsonPath.read(body(mvc.post().uri(base + "/attempts").with(TestUsers.student(student))
                .exchange()), "$.openAttempt.id");
        String q1 = JsonPath.read(body(mvc.get().uri(base).with(TestUsers.student(student)).exchange()),
                "$.questions[0].id");
        String q2 = JsonPath.read(body(mvc.get().uri(base).with(TestUsers.student(student)).exchange()),
                "$.questions[1].id");
        for (String[] answer : new String[][] { { q1, first }, { q2, second } }) {
            assertThat(mvc.put().uri(base + "/attempts/" + attempt + "/answers/" + answer[0])
                    .with(TestUsers.student(student)).contentType(MediaType.APPLICATION_JSON).content(answer[1])
                    .exchange()).hasStatus(HttpStatus.NO_CONTENT);
        }
        assertThat(mvc.post().uri(base + "/attempts/" + attempt + "/submit").with(TestUsers.student(student))
                .exchange()).hasStatusOk();
    }

    private MvcTestResult review(String task) {
        return mvc.get().uri("/api/teacher/homework/tasks/" + task).with(TestUsers.teacher(directory.teacherId()))
                .exchange();
    }

    private MvcTestResult override(String task, String question, boolean correct) {
        return mvc.put().uri(quiz(task, question)).with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"correct\":" + correct + "}").exchange();
    }

    private static String quiz(String task, String question) {
        return "/api/teacher/homework/tasks/" + task + "/quiz/answers/" + question;
    }

    private static String taskOf(MvcTestResult created, UUID student) {
        return JsonPath.<java.util.List<String>>read(body(created), "$.tasks[?(@.studentId=='" + student + "')].taskId")
                .get(0);
    }

    private static String body(MvcTestResult result) {
        return AssignmentIntegrationTests.body(result);
    }
}
