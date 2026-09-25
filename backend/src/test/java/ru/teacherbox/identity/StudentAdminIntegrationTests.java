package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.body;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.api.StudentDeactivated;
import ru.teacherbox.identity.api.StudentReactivated;
import ru.teacherbox.identity.api.StudentRegistered;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;

@IdentityIntegrationTest
class StudentAdminIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    private String teacher;

    @BeforeEach
    void signInAsTeacher() {
        teacher = signInTeacher(mvc).bearer();
    }

    @Test
    void createsStudentWithInvitation(AssertablePublishedEvents events) {
        MvcTestResult result = create("{\"displayName\":\" Мария \",\"email\":\"maria@example.com\",\"note\":\"5 класс\"}");

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.student.displayName").isEqualTo("Мария");
            assertThat(json).extractingPath("$.student.status").isEqualTo("INVITED");
            assertThat(json).extractingPath("$.student.note").isEqualTo("5 класс");
            assertThat(json).extractingPath("$.student.pendingInvite.purpose").isEqualTo("ACTIVATION");
            assertThat(json).extractingPath("$.invite.purpose").isEqualTo("ACTIVATION");
            assertThat(json).extractingPath("$.invite.token").asString().hasSize(43);
        });
        UUID id = UUID.fromString(JsonPath.read(body(result), "$.student.id"));
        assertThat(events).contains(StudentRegistered.class)
                .matching(StudentRegistered::studentId, id)
                .matching(StudentRegistered::displayName, "Мария");

        assertThat(get("/api/teacher/students/" + id)).hasStatusOk()
                .bodyJson().extractingPath("$.email").isEqualTo("maria@example.com");
        assertThat(get("/api/teacher/students")).hasStatusOk()
                .bodyJson().extractingPath("$[?(@.id == '%s')].displayName".formatted(id)).asArray()
                .containsExactly("Мария");
    }

    @Test
    void validatesInput() {
        assertThat(create("{\"displayName\":\"\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().extractingPath("$.errors.displayName").isNotNull();
        assertThat(create("{\"displayName\":\"Имя\",\"email\":\"not-an-email\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("profile.email-invalid");
    }

    @Test
    void updatesProfileWithOptimisticLocking() {
        UUID id = createdId("Олег");

        assertThat(update(id, "Олег Иванов", 0)).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.displayName").isEqualTo("Олег Иванов");
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(update(id, "Устаревшее", 0))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("concurrent.modification");
    }

    @Test
    void unknownStudentIsNotFound() {
        assertThat(get("/api/teacher/students/" + UUID.randomUUID()))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
    }

    @Test
    void studentsCannotManageStudents() {
        ActiveStudent student = activeStudent(students, invites, "Любопытный");
        String bearer = signIn(mvc, student.login(), student.password()).bearer();

        assertThat(mvc.get().uri("/api/teacher/students").header(HttpHeaders.AUTHORIZATION, bearer))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/students")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void deactivatesAndReactivates(AssertablePublishedEvents events) {
        ActiveStudent student = activeStudent(students, invites, "Временно ушёл");

        assertThat(post("/api/teacher/students/" + student.id() + "/deactivate")).hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("DEACTIVATED");
        assertThat(post("/api/teacher/students/" + student.id() + "/deactivate"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(post("/api/teacher/students/" + student.id() + "/invite"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("account.deactivated");

        assertThat(post("/api/teacher/students/" + student.id() + "/reactivate")).hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("ACTIVE");

        assertThat(events).contains(StudentDeactivated.class).matching(StudentDeactivated::studentId, student.id());
        assertThat(events).contains(StudentReactivated.class)
                .matching(StudentReactivated::studentId, student.id())
                .matching(StudentReactivated::status, StudentStatus.ACTIVE);
    }

    @Test
    void deactivationRevokesPendingInvitation() {
        StudentAdminService.CreatedStudent created = students.create(
                ru.teacherbox.identity.domain.Profile.named("Не успел"));

        students.deactivate(created.student().id());

        assertThat(mvc.get().uri("/api/auth/invites/" + created.invite().token()))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(students.reactivate(created.student().id()).status().name()).isEqualTo("INVITED");
    }

    @Test
    void reissuesInvitation() {
        UUID invitedId = createdId("Новенький");
        ActiveStudent active = activeStudent(students, invites, "Забывчивый");

        assertThat(post("/api/teacher/students/" + invitedId + "/invite")).hasStatusOk()
                .bodyJson().extractingPath("$.purpose").isEqualTo("ACTIVATION");
        assertThat(post("/api/teacher/students/" + active.id() + "/invite")).hasStatusOk()
                .bodyJson().extractingPath("$.purpose").isEqualTo("PASSWORD_RESET");
    }

    private UUID createdId(String name) {
        MvcTestResult result = create("{\"displayName\":\"%s\"}".formatted(name));
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return UUID.fromString(JsonPath.read(body(result), "$.student.id"));
    }

    private MvcTestResult create(String json) {
        return mvc.post().uri("/api/teacher/students").header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult update(UUID id, String name, long version) {
        return mvc.put().uri("/api/teacher/students/" + id).header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"%s\",\"version\":%d}".formatted(name, version))
                .exchange();
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).header(HttpHeaders.AUTHORIZATION, teacher).exchange();
    }

    private MvcTestResult post(String uri) {
        return mvc.post().uri(uri).header(HttpHeaders.AUTHORIZATION, teacher).exchange();
    }
}
