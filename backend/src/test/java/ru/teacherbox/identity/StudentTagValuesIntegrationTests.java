package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.application.StudentTagService;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.Tag;

@IdentityIntegrationTest
@TestPropertySource(properties = {
        "teacherbox.identity.admin.login=Admin",
        "teacherbox.identity.admin.password=" + AdministratorIntegrationTests.PASSWORD
})
class StudentTagValuesIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    StudentTagService tags;

    @Autowired
    InviteService invites;

    @Autowired
    JdbcClient jdbc;

    private String teacher;
    private Tag level;
    private Tag grade;

    @BeforeEach
    void setUp() {
        teacher = signInTeacher(mvc).bearer();
        jdbc.sql("delete from identity.student_tags").update();
        jdbc.sql("delete from identity.tag_values").update();
        jdbc.sql("delete from identity.tags").update();
        level = tags.create("Уровень", Tag.Kind.LIST, true, List.of("A1", "A2"));
        grade = tags.create("Класс", Tag.Kind.LIST, false, List.of("7", "8"));
    }

    @Test
    void studentAndAdministratorAreForbidden() {
        ActiveStudent student = activeStudent(students, invites, "Любопытный");
        String uri = "/api/teacher/students/" + student.id() + "/tags";
        String json = "{\"" + level.id() + "\":\"" + level.values().get(0).id() + "\"}";

        for (String bearer : List.of(signIn(mvc, student.login(), student.password()).bearer(),
                signIn(mvc, "admin", AdministratorIntegrationTests.PASSWORD).bearer())) {
            assertThat(mvc.put().uri(uri).header(HttpHeaders.AUTHORIZATION, bearer)
                    .contentType(MediaType.APPLICATION_JSON).content(json)).hasStatus(HttpStatus.FORBIDDEN);
        }
        assertThat(mvc.put().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json))
                .hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void setsReplacesAndClearsValues() {
        UUID id = students.create(Profile.named("Аня")).student().id();
        UUID a1 = level.values().get(0).id();
        UUID a2 = level.values().get(1).id();
        UUID seven = grade.values().get(0).id();

        assertThat(put(id, "{\"" + level.id() + "\":\"" + a1 + "\",\"" + grade.id() + "\":\"" + seven + "\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.tags['" + level.id() + "']").isEqualTo(a1.toString());
                    assertThat(json).extractingPath("$.tags['" + grade.id() + "']").isEqualTo(seven.toString());
                });
        // the body is the whole set: a missing tag is cleared, null clears, another value replaces
        assertThat(put(id, "{\"" + level.id() + "\":\"" + a2 + "\",\"" + grade.id() + "\":null}")).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.tags['" + level.id() + "']").isEqualTo(a2.toString());
                    assertThat(json).extractingPath("$.tags").asMap().hasSize(1);
                });
        assertThat(get("/api/teacher/students/" + id)).hasStatusOk().bodyJson()
                .extractingPath("$.tags['" + level.id() + "']").isEqualTo(a2.toString());
        assertThat(put(id, "{}")).hasStatusOk().bodyJson().extractingPath("$.tags").asMap().isEmpty();
    }

    @Test
    void rejectsForeignValuesUnknownTagsAndUnknownStudents() {
        UUID id = students.create(Profile.named("Боря")).student().id();
        UUID seven = grade.values().get(0).id();

        assertThat(put(id, "{\"" + level.id() + "\":\"" + seven + "\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(id, "{\"" + UUID.randomUUID() + "\":\"" + seven + "\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(id, "{\"" + level.id() + "\":\"" + UUID.randomUUID() + "\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(UUID.randomUUID(), "{}")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void filtersTheListByValue() {
        UUID ann = students.create(Profile.named("Аня")).student().id();
        UUID boris = students.create(Profile.named("Боря")).student().id();
        UUID a1 = level.values().get(0).id();
        UUID a2 = level.values().get(1).id();
        put(ann, "{\"" + level.id() + "\":\"" + a1 + "\"}");
        put(boris, "{\"" + level.id() + "\":\"" + a2 + "\"}");

        assertThat(get("/api/teacher/students?tag=" + a1)).hasStatusOk().bodyJson()
                .extractingPath("$[*].id").asArray().containsExactly(ann.toString());
        assertThat(get("/api/teacher/students?tag=" + UUID.randomUUID())).hasStatusOk().bodyJson()
                .extractingPath("$").asArray().isEmpty();
        assertThat(get("/api/teacher/students")).hasStatusOk().bodyJson()
                .extractingPath("$[*].id").asArray().contains(ann.toString(), boris.toString());
    }

    @Test
    void studentNeverSeesTags() {
        ActiveStudent student = activeStudent(students, invites, "Скрытный");
        put(student.id(), "{\"" + level.id() + "\":\"" + level.values().get(0).id() + "\"}");
        String bearer = signIn(mvc, student.login(), student.password()).bearer();

        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, bearer)).hasStatusOk()
                .bodyText().doesNotContain("tags");
    }

    @Test
    void setsTextTagsTrimmedAndKeepsThemOutOfTheValueFilter() {
        Tag interests = tags.create("Интересы", Tag.Kind.TEXT, true, List.of());
        UUID ann = students.create(Profile.named("Аня")).student().id();
        UUID a1 = level.values().get(0).id();
        String uri = "/api/teacher/students?tag=";

        assertThat(put(ann, "{\"" + interests.id() + "\":\"  футбол, Minecraft \",\"" + level.id() + "\":\"" + a1 + "\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.tags['" + interests.id() + "']").isEqualTo("футбол, Minecraft");
                    assertThat(json).extractingPath("$.tags['" + level.id() + "']").isEqualTo(a1.toString());
                });
        assertThat(get("/api/teacher/students?tag=" + a1)).bodyJson().extractingPath("$[*].id").asArray()
                .containsExactly(ann.toString());
        assertThat(get(uri + "футбол, Minecraft")).hasStatus(HttpStatus.BAD_REQUEST);

        assertThat(put(ann, "{\"" + interests.id() + "\":\"   \"}")).hasStatusOk().bodyJson()
                .extractingPath("$.tags").asMap().isEmpty();
        assertThat(put(ann, "{\"" + interests.id() + "\":\"" + "x".repeat(121) + "\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(ann, "{\"" + interests.id() + "\":\"" + "x".repeat(120) + "\"}")).hasStatusOk();
        assertThat(put(ann, "{\"" + interests.id() + "\":null}")).hasStatusOk().bodyJson()
                .extractingPath("$.tags").asMap().isEmpty();
    }

    private MvcTestResult put(UUID student, String json) {
        return mvc.put().uri("/api/teacher/students/" + student + "/tags")
                .header(HttpHeaders.AUTHORIZATION, teacher).contentType(MediaType.APPLICATION_JSON).content(json)
                .exchange();
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).header(HttpHeaders.AUTHORIZATION, teacher).exchange();
    }
}
