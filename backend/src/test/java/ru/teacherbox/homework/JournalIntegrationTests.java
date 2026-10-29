package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.ReviewService;
import ru.teacherbox.homework.application.ReviewService.Decision;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The journal: students by the assignments due in a range of dates. */
@HomeworkIntegrationTest
class JournalIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    AssignmentService assignments;

    @Autowired
    StudentHomeworkService studentHomework;

    @Autowired
    ReviewService reviews;

    @Autowired
    MutableClock clock;

    @Test
    void everyStatusOfACell() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна журнала");
        Instant now = clock.instant();
        AssignmentDetails accepted = assign("Принято", now.plus(Duration.ofDays(1)), anna);
        AssignmentDetails toReview = assign("Проверить", now.plus(Duration.ofDays(1)), anna);
        AssignmentDetails returned = assign("Вернули", now.plus(Duration.ofDays(1)), anna);
        assign("Ждём", now.plus(Duration.ofDays(1)), anna);
        assign("Опоздала", now.minus(Duration.ofDays(2)).minus(Duration.ofHours(1)), anna);
        assign("Другим", now.plus(Duration.ofDays(1)), directory.addStudent("Не Анна"));
        studentHomework.submit(anna, accepted.tasks().getFirst().taskId(), "Готово", List.of());
        reviews.review(accepted.tasks().getFirst().taskId(), Decision.ACCEPT, "5", null);
        studentHomework.submit(anna, toReview.tasks().getFirst().taskId(), "Готово", List.of());
        studentHomework.submit(anna, returned.tasks().getFirst().taskId(), "Готово", List.of());
        reviews.review(returned.tasks().getFirst().taskId(), Decision.RETURN, null, "Ещё раз");

        String json = journal(anna.toString());

        List<String> titles = JsonPath.read(json, "$.assignments[*].title");
        assertThat(JsonPath.<List<String>>read(json, "$.students[*].studentName")).containsExactly("Анна журнала");
        assertThat(cell(json, titles, "Принято", "status")).isEqualTo("ACCEPTED");
        assertThat(cell(json, titles, "Принято", "grade")).isEqualTo("5");
        assertThat(cell(json, titles, "Проверить", "status")).isEqualTo("TO_REVIEW");
        assertThat(cell(json, titles, "Проверить", "taskId")).isEqualTo(toReview.tasks().getFirst().taskId().toString());
        assertThat(cell(json, titles, "Вернули", "status")).isEqualTo("RETURNED");
        assertThat(cell(json, titles, "Ждём", "status")).isEqualTo("WAITING");
        assertThat(cell(json, titles, "Опоздала", "status")).isEqualTo("OVERDUE");
        assertThat(cell(json, titles, "Опоздала", "overdueDays")).isEqualTo(2);
        assertThat(cell(json, titles, "Другим", "status")).isEqualTo("NOT_ASSIGNED");
        assertThat(cell(json, titles, "Другим", "taskId")).isNull();
        assertThat(JsonPath.<Integer>read(json, "$.students[0].handedIn")).isEqualTo(2);
        assertThat(JsonPath.<Integer>read(json, "$.students[0].given")).isEqualTo(5);
    }

    @Test
    void aGroupShowsItsMembersAndNoOneShowsWhoHasTasks()  throws UnsupportedEncodingException {
        UUID first = directory.addStudent("Б группы");
        UUID second = directory.addStudent("А группы");
        UUID gone = directory.addStudent("Ушёл из группы");
        UUID outside = directory.addStudent("Вне группы");
        UUID group = groups.addGroup("Группа журнала", first, second, gone);
        directory.setStatus(gone, StudentStatus.DEACTIVATED);
        assign("Общее", clock.instant().plus(Duration.ofDays(1)), first, outside);

        assertThat(JsonPath.<List<String>>read(journal(group.toString()), "$.students[*].studentName"))
                .containsExactly("А группы", "Б группы");
        List<String> everyone = JsonPath.read(journal(null), "$.students[*].studentName");
        assertThat(everyone).contains("Б группы", "Вне группы").doesNotContain("А группы");
    }

    @Test
    void onlyAssignmentsDueInTheRangeAreColumns() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Диапазон");
        Instant now = clock.instant();
        assign("В диапазоне", now.plus(Duration.ofDays(1)), student);
        assign("Далеко", now.plus(Duration.ofDays(60)), student);
        assign("Без срока", null, student);

        List<String> titles = JsonPath.read(journal(student.toString()), "$.assignments[*].title");

        assertThat(titles).contains("В диапазоне").doesNotContain("Далеко", "Без срока");
    }

    @Test
    void anEmptyRangeHasNoColumns() throws UnsupportedEncodingException {
        String json = mvc.get().uri("/api/teacher/homework/journal?from=2001-01-01&to=2001-01-07")
                .with(teacher()).exchange().getResponse().getContentAsString();

        assertThat(JsonPath.<List<?>>read(json, "$.assignments")).isEmpty();
        assertThat(JsonPath.<List<?>>read(json, "$.students")).isEmpty();
    }

    @Test
    void onlyTheTeacherReadsTheJournal() {
        String uri = "/api/teacher/homework/journal?from=2026-01-01&to=2026-01-07";

        assertThat(mvc.get().uri(uri).with(teacher())).hasStatusOk();
        assertThat(mvc.get().uri(uri).with(TestUsers.student(directory.addStudent("Не учитель"))))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).with(TestUsers.admin(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
    }

    private String journal(String who) throws UnsupportedEncodingException {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        String uri = "/api/teacher/homework/journal?from=" + today.minusDays(10) + "&to=" + today.plusDays(10)
                + (who == null ? "" : "&who=" + who);
        MvcTestResult result = mvc.get().uri(uri).with(teacher()).exchange();
        assertThat(result).hasStatusOk();
        return result.getResponse().getContentAsString();
    }

    private static Object cell(String json, List<String> titles, String title, String field) {
        return JsonPath.read(json, "$.students[0].cells[" + titles.indexOf(title) + "]." + field);
    }

    private AssignmentDetails assign(String title, Instant dueAt, UUID... students) {
        return assignments.create(title, null, dueAt, List.of(students));
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
