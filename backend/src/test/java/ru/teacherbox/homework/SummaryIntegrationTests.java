package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Home page counters: works to review and deadlines. */
@HomeworkIntegrationTest
class SummaryIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    AssignmentService assignments;

    @Autowired
    StudentHomeworkService studentHomework;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherSeesWorksToReviewAndDeadlines() throws UnsupportedEncodingException {
        String before = summary();
        UUID student = directory.addStudent("Сводка заданий");
        UUID gone = directory.addStudent("Ушёл");
        Instant now = clock.instant();
        assign("Просрочено", now.minus(Duration.ofHours(1)), student, gone);
        assign("Скоро срок", now.plus(Duration.ofDays(1)), student);
        assign("Не скоро", now.plus(Duration.ofDays(10)), student);
        AssignmentDetails handedIn = assign("Сдано", null, student);
        studentHomework.submit(student, handedIn.tasks().getFirst().taskId(), "Готово", List.of());
        directory.setStatus(gone, StudentStatus.DEACTIVATED);

        String after = summary();

        assertThat(count(after, "$.toReview")).isEqualTo(count(before, "$.toReview") + 1);
        assertThat(count(after, "$.overdue")).isEqualTo(count(before, "$.overdue") + 1);
        assertThat(count(after, "$.dueSoon")).isEqualTo(count(before, "$.dueSoon") + 1);
        assertThat(JsonPath.<List<String>>read(after, "$.oldestToReview[*].title")).hasSizeLessThanOrEqualTo(3);
    }

    @Test
    void aStudentSeesOpenTasksByDeadline() {
        UUID student = directory.addStudent("Мои сроки");
        Instant now = clock.instant();
        assign("Без срока", null, student);
        assign("Через неделю", now.plus(Duration.ofDays(7)), student);
        assign("Вчера", now.minus(Duration.ofDays(1)), student);
        AssignmentDetails handedIn = assign("Уже сдано", now.plus(Duration.ofDays(2)), student);
        studentHomework.submit(student, handedIn.tasks().getFirst().taskId(), "Готово", List.of());
        assign("Чужое", now.plus(Duration.ofDays(1)), directory.addStudent("Другой"));

        assertThat(mvc.get().uri("/api/me/homework/summary").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.open").isEqualTo(3);
                    assertThat(json).extractingPath("$.overdue").isEqualTo(1);
                    assertThat(json).extractingPath("$.upcoming[*].title").asArray()
                            .containsExactly("Вчера", "Через неделю", "Без срока");
                });
    }

    @Test
    void summariesRespectRoles() {
        UUID student = directory.addStudent("Не учитель");

        assertThat(mvc.get().uri("/api/teacher/homework/summary").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/homework/summary").with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private AssignmentDetails assign(String title, @Nullable Instant dueAt, UUID... students) {
        return assignments.create(title, null, dueAt, List.of(students));
    }

    private String summary() throws UnsupportedEncodingException {
        MvcTestResult result = mvc.get().uri("/api/teacher/homework/summary").with(teacher()).exchange();
        assertThat(result).hasStatusOk();
        return result.getResponse().getContentAsString();
    }

    private static int count(String json, String path) {
        return JsonPath.<Integer>read(json, path);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
