package ru.teacherbox.textbooks;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.CourseDeleted;
import ru.teacherbox.textbooks.api.CourseSummary;
import ru.teacherbox.textbooks.api.Courses;
import ru.teacherbox.textbooks.api.Textbooks;

/** Courses, the current courses of students and groups, textbooks shared with «Ученики курса» (ADR-0071). */
@TextbooksIntegrationTest
class CoursesIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    Courses facade;

    @Autowired
    Textbooks textbooks;

    @Test
    void theTeacherKeepsCoursesWithUniqueNames() throws Exception {
        String a2 = createCourse(" Английский A2 ");
        String oge = createCourse("ОГЭ математика");

        assertThat(post("/api/teacher/textbooks/courses", "{\"name\":\"английский a2\"}"))
                .hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.course-exists");
        assertThat(post("/api/teacher/textbooks/courses", "{\"name\":\" \"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("/api/teacher/textbooks/courses", "{\"name\":\"%s\"}".formatted("к".repeat(101))))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.get().uri("/api/teacher/textbooks/courses").with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.id == '%s')].name".formatted(a2)).asArray()
                            .containsExactly("Английский A2");
                    assertThat(json).extractingPath("$[*].id").asArray().containsSubsequence(a2, oge);
                });

        assertThat(put("/api/teacher/textbooks/courses/" + a2, "{\"name\":\"Английский B1\",\"version\":0}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.name").isEqualTo("Английский B1");
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(put("/api/teacher/textbooks/courses/" + a2, "{\"name\":\"Английский C1\",\"version\":0}"))
                .as("stale version").hasStatus(HttpStatus.CONFLICT);
        assertThat(put("/api/teacher/textbooks/courses/" + a2, "{\"name\":\"огэ МАТЕМАТИКА\",\"version\":1}"))
                .hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.course-exists");
        assertThat(put("/api/teacher/textbooks/courses/" + a2, "{\"name\":\"английский b1\",\"version\":1}"))
                .as("its own name in another case").hasStatusOk();
        assertThat(put("/api/teacher/textbooks/courses/" + UUID.randomUUID(), "{\"name\":\"X\",\"version\":0}"))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.course-not-found");

        assertThat(facade.find(UUID.fromString(oge))).contains(new CourseSummary(UUID.fromString(oge),
                "ОГЭ математика"));
        assertThat(facade.find(List.of(UUID.fromString(oge), UUID.randomUUID()))).extracting(CourseSummary::name)
                .containsExactly("ОГЭ математика");
    }

    @Test
    void studentsAndGroupsHaveOneCurrentCourse() throws Exception {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Группа A2", anna);
        UUID a2 = UUID.fromString(createCourse("Курс ссылок A2"));
        UUID b1 = UUID.fromString(createCourse("Курс ссылок B1"));

        assertThat(link("students", anna, a2)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(link("students", anna, b1)).as("replaces the course").hasStatus(HttpStatus.NO_CONTENT);
        assertThat(link("groups", group, a2)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(facade.ofStudent(anna)).map(CourseSummary::id).contains(b1);
        assertThat(facade.ofGroup(group)).map(CourseSummary::name).contains("Курс ссылок A2");
        assertThat(mvc.get().uri("/api/teacher/textbooks/course-links").with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.students[?(@.studentId == '%s')].courseId".formatted(anna))
                            .asArray().containsExactly(b1.toString());
                    assertThat(json).extractingPath("$.groups[?(@.groupId == '%s')].courseId".formatted(group))
                            .asArray().containsExactly(a2.toString());
                });

        assertThat(link("students", UUID.randomUUID(), a2)).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.student-not-found");
        assertThat(link("groups", UUID.randomUUID(), a2)).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.group-not-found");
        assertThat(link("students", anna, UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.course-not-found");
        assertThat(link("groups", group, UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND);
        UUID gone = directory.addStudent("Ушедший", StudentStatus.DEACTIVATED);
        UUID old = groups.addGroup("Архив");
        groups.archive(old);
        assertThat(link("students", gone, a2)).as("a deactivated student").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(link("groups", old, a2)).as("an archived group").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(link("students", gone, null)).as("no course is always allowed").hasStatus(HttpStatus.NO_CONTENT);
        assertThat(link("groups", old, null)).hasStatus(HttpStatus.NO_CONTENT);

        assertThat(link("students", anna, null)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(link("groups", group, null)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(facade.ofStudent(anna)).isEmpty();
        assertThat(facade.ofGroup(group)).isEmpty();
    }

    @Test
    void aTextbookSharedWithACourseOpensForItsStudentsAndGroups() throws Exception {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID other = directory.addStudent("Чужой");
        UUID group = groups.addGroup("Группа ОГЭ", boris);
        UUID course = UUID.fromString(createCourse("Курс доступа"));
        UUID otherCourse = UUID.fromString(createCourse("Другой курс доступа"));
        link("students", anna, course);
        link("groups", group, course);
        link("students", other, otherCourse);

        MvcTestResult created = mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart()
                .file(file()).param("kind", "TEXTBOOK").param("title", "Сборник ОГЭ")
                .param("courseIds", course.toString()).exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.members[0].type").isEqualTo("COURSE");
            assertThat(json).extractingPath("$.members[0].name").isEqualTo("Курс доступа");
        });
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        assertThat(myTitles(anna)).contains("Сборник ОГЭ");
        assertThat(myTitles(boris)).as("through the group's course").contains("Сборник ОГЭ");
        assertThat(myTitles(other)).as("another student").doesNotContain("Сборник ОГЭ");
        assertThat(myFile(anna, id)).hasStatusOk();
        assertThat(myFile(boris, id)).hasStatusOk();
        assertThat(myFile(other, id)).as("another student").hasStatus(HttpStatus.NOT_FOUND);

        groups.setMembers(group, List.of());
        assertThat(myFile(boris, id)).as("left the group").hasStatus(HttpStatus.NOT_FOUND);
        link("students", anna, otherCourse);
        assertThat(myFile(anna, id)).as("another current course").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(myFile(other, id)).hasStatus(HttpStatus.NOT_FOUND);

        assertThat(mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart().file(file())
                .param("kind", "TEXTBOOK").param("title", "Нет курса").param("courseIds", UUID.randomUUID().toString()))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.course-not-found");
        assertThat(mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart().file(file())
                .param("kind", "TEXTBOOK").param("title", "Нет курса").param("courseId", UUID.randomUUID().toString()))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.course-not-found");
    }

    @Test
    void aDeletedCourseLeavesItsTextbooksStudentsAndGroups(AssertablePublishedEvents events) throws Exception {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Группа удаления", anna);
        UUID course = UUID.fromString(createCourse("Курс на удаление"));
        link("students", anna, course);
        link("groups", group, course);
        MvcTestResult created = mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart().file(file())
                .param("kind", "TEXTBOOK").param("title", "Учебник курса").param("courseId", course.toString())
                .param("courseIds", course.toString()).exchange();
        UUID id = UUID.fromString(JsonPath.read(created.getResponse().getContentAsString(), "$.id"));
        assertThat(textbooks.find(id)).hasValueSatisfying(summary -> {
            assertThat(summary.courseId()).isEqualTo(course);
            assertThat(summary.courseName()).isEqualTo("Курс на удаление");
        });

        assertThat(mvc.delete().uri("/api/teacher/textbooks/courses/" + course).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);

        assertThat(events).contains(CourseDeleted.class).matching(CourseDeleted::courseId, course);
        assertThat(textbooks.find(List.of(id))).singleElement().satisfies(summary -> {
            assertThat(summary.courseId()).isNull();
            assertThat(summary.courseName()).isNull();
        });
        assertThat(mvc.get().uri("/api/teacher/textbooks").with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.id == '%s')].version".formatted(id)).asArray()
                            .containsExactly(1);
                    assertThat(json).extractingPath("$[?(@.id == '%s')].members[*]".formatted(id)).asArray()
                            .isEmpty();
                });
        assertThat(facade.ofStudent(anna)).isEmpty();
        assertThat(facade.ofGroup(group)).isEmpty();
        assertThat(mvc.delete().uri("/api/teacher/textbooks/courses/" + course).with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void onlyTheTeacherManagesCourses() {
        UUID student = directory.addStudent("Любопытный");
        RequestPostProcessor asStudent = TestUsers.student(student);
        assertThat(mvc.get().uri("/api/teacher/textbooks/courses").with(asStudent)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/textbooks/course-links").with(asStudent))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/textbooks/courses").with(asStudent)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Свой\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri("/api/teacher/textbooks/students/" + student + "/course").with(asStudent)
                .contentType(MediaType.APPLICATION_JSON).content("{\"courseId\":null}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private String createCourse(String name) throws Exception {
        MvcTestResult created = post("/api/teacher/textbooks/courses", "{\"name\":\"%s\"}".formatted(name));
        assertThat(created).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(created.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }

    private MvcTestResult link(String owner, UUID ownerId, UUID courseId) {
        return put("/api/teacher/textbooks/" + owner + "/" + ownerId + "/course",
                courseId == null ? "{\"courseId\":null}" : "{\"courseId\":\"%s\"}".formatted(courseId));
    }

    private List<String> myTitles(UUID student) throws Exception {
        MvcTestResult result = mvc.get().uri("/api/me/textbooks").with(TestUsers.student(student)).exchange();
        assertThat(result).hasStatusOk();
        return JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$[*].title");
    }

    private MvcTestResult myFile(UUID student, String id) {
        return mvc.get().uri("/api/me/textbooks/" + id + "/file").with(TestUsers.student(student)).exchange();
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private static MockMultipartFile file() {
        return new MockMultipartFile("file", "a.png", "application/octet-stream", TestFiles.png());
    }
}
