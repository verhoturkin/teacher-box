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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The students of a draft: remembered for «Выдать» later, invisible to them, dropped once given out. */
@HomeworkIntegrationTest
class DraftStudentsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void remembersWhomADraftIsForWithoutGivingItOut() {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        String base = "/api/teacher/homework/assignments/" + draft();

        assertThat(put(base, "[\"%s\",\"%s\"]".formatted(anna, boris))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.draftStudentIds.length()").isEqualTo(2);
                    assertThat(json).extractingPath("$.tasks.length()").isEqualTo(0);
                });
        assertThat(mvc.get().uri("/api/me/homework").with(TestUsers.student(anna)).exchange())
                .hasStatusOk().bodyJson().extractingPath("$.length()").isEqualTo(0);
        assertThat(put(base, "[\"%s\"]".formatted(boris))).hasStatusOk().bodyJson()
                .extractingPath("$.draftStudentIds.length()").isEqualTo(1);
    }

    @Test
    void dropsThemOnceTheAssignmentIsGivenOut() {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        String base = "/api/teacher/homework/assignments/" + draft();
        assertThat(put(base, "[\"%s\",\"%s\"]".formatted(anna, boris))).hasStatusOk();

        assertThat(mvc.post().uri(base + "/students").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentIds\":[\"%s\"]}".formatted(anna))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.tasks.length()").isEqualTo(1);
                    assertThat(json).extractingPath("$.draftStudentIds.length()").isEqualTo(1);
                    assertThat(json).extractingPath("$.draftStudentIds[0]").isEqualTo(boris.toString());
                });
    }

    @Test
    void checksTheRoleTheAssignmentAndTheStudents() {
        UUID anna = directory.addStudent("Анна");
        String base = "/api/teacher/homework/assignments/" + draft();

        assertThat(mvc.put().uri(base + "/draft-students").with(TestUsers.student(anna))
                .contentType(MediaType.APPLICATION_JSON).content("{\"studentIds\":[]}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri("/api/teacher/homework/assignments/" + UUID.randomUUID() + "/draft-students")
                .with(teacher()).contentType(MediaType.APPLICATION_JSON).content("{\"studentIds\":[]}"))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(put(base, "[\"%s\"]".formatted(UUID.randomUUID()))).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
    }

    private MvcTestResult put(String base, String ids) {
        return mvc.put().uri(base + "/draft-students").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentIds\":" + ids + "}").exchange();
    }

    private String draft() {
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Дроби\"}").exchange();
        return JsonPath.read(AssignmentIntegrationTests.body(created), "$.id");
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
