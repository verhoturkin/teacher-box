package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeCourses;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.CourseDeleted;

/** The course of an assignment (ADR-0071): checked by textbooks, kept by a copy, cleared with the course. */
@HomeworkIntegrationTest
class AssignmentCoursesIntegrationTests {

    private static final String ASSIGNMENTS = "/api/teacher/homework/assignments";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeCourses courses;

    @Test
    void anAssignmentBelongsToACourse() {
        UUID a2 = courses.add("Английский A2");
        UUID b1 = courses.add("Английский B1");
        MvcTestResult created = post(ASSIGNMENTS, "{\"title\":\"Present Simple\",\"courseId\":\"%s\"}".formatted(a2));
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.courseId")
                .isEqualTo(a2.toString());
        String id = JsonPath.read(AssignmentIntegrationTests.body(created), "$.id");
        assertThat(mvc.get().uri(ASSIGNMENTS).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '%s')].courseId".formatted(id)).asArray()
                .containsExactly(a2.toString());

        assertThat(post(ASSIGNMENTS, "{\"title\":\"X\",\"courseId\":\"%s\"}".formatted(UUID.randomUUID())))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("assignment.course-not-found");

        assertThat(put(id, "{\"title\":\"Present Simple\",\"courseId\":\"%s\",\"version\":0}".formatted(b1)))
                .hasStatusOk().bodyJson().extractingPath("$.courseId").isEqualTo(b1.toString());
        assertThat(put(id, "{\"title\":\"Present Simple\",\"courseId\":\"%s\",\"version\":1}"
                .formatted(UUID.randomUUID()))).hasStatus(HttpStatus.NOT_FOUND);
        courses.remove(b1);
        assertThat(put(id, "{\"title\":\"Past Simple\",\"courseId\":\"%s\",\"version\":1}".formatted(b1)))
                .as("an unchanged course is not checked again").hasStatusOk();

        assertThat(mvc.post().uri(ASSIGNMENTS + "/" + id + "/copy").with(teacher())).hasStatus(HttpStatus.CREATED)
                .bodyJson().extractingPath("$.courseId").isEqualTo(b1.toString());
        assertThat(put(id, "{\"title\":\"Past Simple\",\"version\":2}")).hasStatusOk().bodyJson()
                .extractingPath("$.courseId").isNull();
    }

    @Test
    void aDeletedCourseLeavesItsAssignments(Scenario scenario) {
        UUID course = courses.add("ОГЭ");
        String id = JsonPath.read(AssignmentIntegrationTests.body(
                post(ASSIGNMENTS, "{\"title\":\"Вариант 1\",\"courseId\":\"%s\"}".formatted(course))), "$.id");

        scenario.publish(new CourseDeleted(course))
                .andWaitForStateChange(() -> JsonPath.read(AssignmentIntegrationTests.body(
                        mvc.get().uri(ASSIGNMENTS + "/" + id).with(teacher()).exchange()), "$.courseId") == null);

        assertThat(mvc.get().uri(ASSIGNMENTS + "/" + id).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.version").isEqualTo(0);
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String id, String json) {
        return mvc.put().uri(ASSIGNMENTS + "/" + id).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
