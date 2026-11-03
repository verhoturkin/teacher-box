package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.body;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;

@IdentityIntegrationTest
class TagIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Autowired
    JdbcClient jdbc;

    private String teacher;

    @BeforeEach
    void signInAsTeacher() {
        teacher = signInTeacher(mvc).bearer();
        jdbc.sql("delete from identity.student_tags").update();
        jdbc.sql("delete from identity.tag_values").update();
        jdbc.sql("delete from identity.tags").update();
    }

    @Test
    void onlyTheTeacherManagesTags() {
        ActiveStudent student = activeStudent(students, invites, "Любопытный");
        String bearer = signIn(mvc, student.login(), student.password()).bearer();

        assertThat(mvc.get().uri("/api/teacher/tags").header(HttpHeaders.AUTHORIZATION, bearer))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/tags").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"useInAi\":false,\"name\":\"Класс\",\"values\":[\"1\"]}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.delete().uri("/api/teacher/tags/" + UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, bearer))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/tags")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer)).hasStatusOk()
                .bodyText().doesNotContain("tags");
    }

    @Test
    void createsAndListsTagsInOrder() {
        MvcTestResult created = create("{\"name\":\" Уровень английского \",\"useInAi\":true,"
                + "\"values\":[\"A1\",\" A2 \",\"B1\"]}");

        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.name").isEqualTo("Уровень английского");
            assertThat(json).extractingPath("$.useInAi").isEqualTo(true);
            assertThat(json).extractingPath("$.values[*].label").asArray().containsExactly("A1", "A2", "B1");
            assertThat(json).extractingPath("$.version").isEqualTo(0);
        });
        UUID level = id(created);
        UUID grade = id(create("{\"useInAi\":false,\"name\":\"Класс\",\"values\":[\"7\",\"8\"]}"));

        assertThat(get()).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].name").asArray().containsExactly("Уровень английского", "Класс");
            assertThat(json).extractingPath("$[1].useInAi").isEqualTo(false);
        });

        assertThat(put("/api/teacher/tags/order", "{\"ids\":[\"%s\",\"%s\"]}".formatted(grade, level))).hasStatusOk()
                .bodyJson().extractingPath("$[*].name").asArray().containsExactly("Класс", "Уровень английского");
        assertThat(get()).bodyJson().extractingPath("$[*].id").asArray()
                .containsExactly(grade.toString(), level.toString());
        assertThat(put("/api/teacher/tags/order", "{\"ids\":[\"%s\"]}".formatted(grade)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.order-invalid");
        assertThat(put("/api/teacher/tags/order", "{\"ids\":[\"%s\",\"%s\"]}".formatted(grade, grade)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void rejectsInvalidTags() {
        create("{\"useInAi\":false,\"name\":\"Класс\",\"values\":[\"1\"]}");

        assertThat(create("{\"useInAi\":false,\"name\":\"класс\",\"values\":[\"1\"]}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.name-taken");
        assertThat(create("{\"useInAi\":false,\"name\":\"Цель\",\"values\":[\"ЕГЭ\",\"егэ\"]}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.value-duplicate");
        assertThat(create("{\"useInAi\":false,\"name\":\"Цель\",\"values\":[]}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(create("{\"useInAi\":false,\"name\":\"\",\"values\":[\"1\"]}")).hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().extractingPath("$.errors.name").isNotNull();
        assertThat(create("{\"useInAi\":false,\"name\":\"Цель\",\"values\":[\"%s\"]}".formatted("x".repeat(41))))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(create("{\"useInAi\":false,\"name\":\"%s\",\"values\":[\"1\"]}".formatted("x".repeat(61))))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void limitsTheNumberOfTags() {
        for (int i = 0; i < 30; i++) {
            assertThat(create("{\"useInAi\":false,\"name\":\"Тег %d\",\"values\":[\"1\"]}".formatted(i))).hasStatus(HttpStatus.CREATED);
        }
        assertThat(create("{\"useInAi\":false,\"name\":\"Лишний\",\"values\":[\"1\"]}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.limit");
    }

    @Test
    void changesValuesAndClearsRemovedOnesFromStudents() {
        MvcTestResult created = create("{\"useInAi\":false,\"name\":\"Класс\",\"values\":[\"7\",\"8\",\"9\"]}");
        UUID tag = id(created);
        List<String> ids = JsonPath.read(body(created), "$.values[*].id");
        UUID seven = UUID.fromString(ids.get(0));
        UUID eight = UUID.fromString(ids.get(1));
        UUID nine = UUID.fromString(ids.get(2));
        setTag(student("Анна"), tag, seven);
        setTag(student("Борис"), tag, seven);
        setTag(student("Вера"), tag, nine);

        MvcTestResult changed = put("/api/teacher/tags/" + tag, """
                {"name":"Класс школы","useInAi":true,"values":[{"id":"%s","label":"9 класс"},{"label":"10"},
                {"id":"%s","label":"8"}],"version":0}""".formatted(nine, eight));

        assertThat(changed).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.clearedStudents").isEqualTo(2);
            assertThat(json).extractingPath("$.tag.name").isEqualTo("Класс школы");
            assertThat(json).extractingPath("$.tag.useInAi").isEqualTo(true);
            assertThat(json).extractingPath("$.tag.values[*].label").asArray().containsExactly("9 класс", "10", "8");
            assertThat(json).extractingPath("$.tag.values[0].id").isEqualTo(nine.toString());
            assertThat(json).extractingPath("$.tag.version").isEqualTo(1);
        });
        assertThat(get()).bodyJson().extractingPath("$[0].values[*].label").asArray()
                .containsExactly("9 класс", "10", "8");
        assertThat(studentTags()).isEqualTo(1);

        assertThat(put("/api/teacher/tags/" + tag, "{\"useInAi\":false,\"name\":\"Класс\",\"values\":[{\"label\":\"1\"}],\"version\":0}"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("concurrent.modification");
        assertThat(put("/api/teacher/tags/" + tag, """
                {"name":"Класс","useInAi":false,"values":[{"id":"%s","label":"1"}],"version":1}""".formatted(seven)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.value-unknown");
        assertThat(put("/api/teacher/tags/" + UUID.randomUUID(), "{\"useInAi\":false,\"name\":\"Класс\",\"values\":[{\"label\":\"1\"}],"
                + "\"version\":0}")).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.not-found");
    }

    @Test
    void aTagCannotTakeTheNameOfAnother() {
        create("{\"useInAi\":false,\"name\":\"Цель\",\"values\":[\"ЕГЭ\"]}");
        UUID grade = id(create("{\"useInAi\":false,\"name\":\"Класс\",\"values\":[\"1\"]}"));

        assertThat(put("/api/teacher/tags/" + grade, "{\"useInAi\":false,\"name\":\"ЦЕЛЬ\",\"values\":[{\"label\":\"1\"}],\"version\":0}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("tag.name-taken");
    }

    @Test
    void deletesATagWithItsValuesOnStudents() {
        MvcTestResult created = create("{\"useInAi\":false,\"name\":\"Цель\",\"values\":[\"ОГЭ\"]}");
        UUID tag = id(created);
        setTag(student("Анна"), tag, UUID.fromString(JsonPath.read(body(created), "$.values[0].id")));

        assertThat(mvc.delete().uri("/api/teacher/tags/" + tag).header(HttpHeaders.AUTHORIZATION, teacher))
                .hasStatusOk().bodyJson().extractingPath("$.clearedStudents").isEqualTo(1);
        assertThat(get()).bodyJson().extractingPath("$").asArray().isEmpty();
        assertThat(studentTags()).isZero();
        assertThat(mvc.delete().uri("/api/teacher/tags/" + tag).header(HttpHeaders.AUTHORIZATION, teacher))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    private UUID student(String name) {
        return students.create(Profile.named(name)).student().id();
    }

    // shortcut: rows written directly until PUT /api/teacher/students/{id}/tags (362.2) exists
    private void setTag(UUID student, UUID tag, UUID value) {
        jdbc.sql("insert into identity.student_tags (student_id, tag_id, value_id) values (:s, :t, :v)")
                .param("s", student).param("t", tag).param("v", value).update();
    }

    private long studentTags() {
        return jdbc.sql("select count(*) from identity.student_tags").query(Long.class).single();
    }

    private static UUID id(MvcTestResult result) {
        return UUID.fromString(JsonPath.read(body(result), "$.id"));
    }

    private MvcTestResult get() {
        return mvc.get().uri("/api/teacher/tags").header(HttpHeaders.AUTHORIZATION, teacher).exchange();
    }

    private MvcTestResult create(String json) {
        return mvc.post().uri("/api/teacher/tags").header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }
}
