package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.body;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;
import static ru.teacherbox.identity.IdentityTestSupport.tokens;
import static ru.teacherbox.identity.IdentityTestSupport.uniqueLogin;

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
import ru.teacherbox.identity.IdentityTestSupport.Tokens;
import ru.teacherbox.identity.api.GuardianLinked;
import ru.teacherbox.identity.api.GuardianRegistered;
import ru.teacherbox.identity.api.GuardianSummary;
import ru.teacherbox.identity.api.GuardianUnlinked;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;
import ru.teacherbox.shared.security.Role;

/** Guardians (parents) of students (ADR-0069): invitation, links, the limit of two and access. */
@IdentityIntegrationTest
class GuardianIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Autowired
    GuardianAccess access;

    @Autowired
    Guardians guardians;

    @Autowired
    UserDirectory directory;

    private String teacher;

    @BeforeEach
    void signInAsTeacher() {
        teacher = signInTeacher(mvc).bearer();
    }

    @Test
    void theTeacherInvitesAParentWhoSignsUpAndSeesTheChild(AssertablePublishedEvents events) {
        ActiveStudent petya = activeStudent(students, invites, "Петя Иванов");

        MvcTestResult created = createGuardian(petya.id(), " Анна ");
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.guardian.displayName").isEqualTo("Анна");
            assertThat(json).extractingPath("$.guardian.status").isEqualTo("INVITED");
            assertThat(json).extractingPath("$.guardian.pendingInvite.purpose").isEqualTo("ACTIVATION");
            assertThat(json).extractingPath("$.guardian.studentIds").asArray().containsExactly(petya.id().toString());
            assertThat(json).extractingPath("$.invite.purpose").isEqualTo("ACTIVATION");
        });
        UUID anna = UUID.fromString(JsonPath.read(body(created), "$.guardian.id"));
        String token = JsonPath.read(body(created), "$.invite.token");
        assertThat(events).contains(GuardianRegistered.class).matching(GuardianRegistered::guardianId, anna)
                .matching(GuardianRegistered::displayName, "Анна");
        assertThat(events).contains(GuardianLinked.class).matching(GuardianLinked::guardianId, anna)
                .matching(GuardianLinked::studentId, petya.id());

        assertThat(get("/api/teacher/students/" + petya.id() + "/guardians", teacher)).hasStatusOk()
                .bodyJson().extractingPath("$[*].displayName").asArray().containsExactly("Анна");
        assertThat(get("/api/teacher/guardians", teacher)).hasStatusOk()
                .bodyJson().extractingPath("$[?(@.id == '%s')].displayName".formatted(anna)).asArray()
                .containsExactly("Анна");

        assertThat(mvc.get().uri("/api/auth/invites/" + token)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.role").isEqualTo("GUARDIAN");
            assertThat(json).extractingPath("$.displayName").isEqualTo("Анна");
            assertThat(json).extractingPath("$.children").asArray().containsExactly("Петя");
        });
        String login = uniqueLogin("anna");
        MvcTestResult accepted = accept(token, login, "anna-password");
        assertThat(accepted).hasStatusOk().bodyJson().extractingPath("$.user.role").isEqualTo("GUARDIAN");
        assertThat(events.ofType(StudentActivated.class).matching(e -> e.studentId().equals(anna))).isEmpty();
        String guardian = tokens(accepted).bearer();

        assertThat(get("/api/guardian/children", guardian)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].id").asArray().containsExactly(petya.id().toString());
            assertThat(json).extractingPath("$[0].displayName").isEqualTo("Петя Иванов");
        });
        assertThat(get("/api/me/guardians", signIn(mvc, petya.login(), petya.password()).bearer())).hasStatusOk()
                .bodyJson().isLenientlyEqualTo("[{\"displayName\":\"Анна\"}]");
        assertThat(guardians.guardiansOf(petya.id()))
                .containsExactly(new GuardianSummary(anna, "Анна", StudentStatus.ACTIVE));
        assertThat(directory.guardianName(anna)).contains("Анна");
        assertThat(directory.guardianName(petya.id())).isEmpty();
        assertThat(directory.language(anna)).isEqualTo(Language.RU);
    }

    @Test
    void eachRoleKeepsToItsOwnEndpoints() {
        ActiveStudent child = activeStudent(students, invites, "Вера");
        String student = signIn(mvc, child.login(), child.password()).bearer();
        String guardian = activeGuardian(child.id(), "Олег").bearer();

        assertThat(get("/api/guardian/children", student)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/guardian/children", teacher)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/guardian/children", null)).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(get("/api/me/guardians", teacher)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/me/guardians", guardian)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/teacher/students/" + child.id() + "/guardians", guardian))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/teacher/guardians", student)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/me", guardian)).hasStatusOk().bodyJson().extractingPath("$.role").isEqualTo("GUARDIAN");
    }

    @Test
    void theGuardOpensOnlyTheGuardiansCurrentChildren() {
        ActiveStudent child = activeStudent(students, invites, "Лиза");
        ActiveStudent stranger = activeStudent(students, invites, "Чужой");
        Tokens guardian = activeGuardian(child.id(), "Ирина");
        CurrentUser asGuardian = new CurrentUser(guardian.userId(), Role.GUARDIAN, "Ирина");

        access.require(asGuardian, child.id());
        assertThat(access.children(guardian.userId())).containsExactly(child.id());
        assertThat(guardians.isGuardianOf(guardian.userId(), child.id())).isTrue();
        assertThatThrownBy(() -> access.require(asGuardian, stranger.id())).isInstanceOf(NotFoundException.class)
                .hasFieldOrPropertyWithValue("code", "student.not-found");
        assertThatThrownBy(() -> access.require(asGuardian, UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> access.require(new CurrentUser(child.id(), Role.STUDENT, "Лиза"), child.id()))
                .isInstanceOf(ForbiddenException.class);
        assertThat(access.children(child.id())).isEmpty();
        assertThat(guardians.childrenOf(stranger.id())).isEmpty();
    }

    @Test
    void aStudentHasAtMostTwoParents() {
        UUID child = students.create(Profile.named("Гоша")).student().id();
        assertThat(createGuardian(child, "Мама")).hasStatus(HttpStatus.CREATED);
        assertThat(createGuardian(child, "Папа")).hasStatus(HttpStatus.CREATED);

        assertThat(createGuardian(child, "Бабушка")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("guardian.limit");
        UUID other = students.create(Profile.named("Соня")).student().id();
        UUID grandma = UUID.fromString(JsonPath.read(body(createGuardian(other, "Бабушка")), "$.guardian.id"));
        assertThat(link(child, grandma)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("guardian.limit");
        assertThat(get("/api/teacher/students/" + child + "/guardians", teacher)).hasStatusOk()
                .bodyJson().extractingPath("$[*].displayName").asArray().containsExactly("Мама", "Папа");
    }

    @Test
    void aSiblingsParentIsLinkedWithoutAnInvitation(AssertablePublishedEvents events) {
        ActiveStudent first = activeStudent(students, invites, "Маша");
        ActiveStudent second = activeStudent(students, invites, "Миша");
        Tokens mother = activeGuardian(first.id(), "Елена");

        assertThat(link(second.id(), mother.userId())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("ACTIVE");
            assertThat(json).extractingPath("$.pendingInvite").isNull();
            assertThat(json).extractingPath("$.studentIds").asArray()
                    .containsExactly(first.id().toString(), second.id().toString());
        });
        assertThat(events).contains(GuardianLinked.class).matching(GuardianLinked::studentId, second.id());
        assertThat(guardians.childrenOf(mother.userId())).extracting(StudentSummary::id)
                .containsExactly(first.id(), second.id());

        assertThat(link(second.id(), mother.userId())).hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("guardian.already-linked");
        assertThat(link(second.id(), first.id())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("guardian.not-found");
        assertThat(link(UUID.randomUUID(), mother.userId())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        assertThat(mvc.post().uri("/api/teacher/students/" + second.id() + "/guardians/link")
                .header(HttpHeaders.AUTHORIZATION, teacher).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void unlinkingTheLastChildDeactivatesTheParent(AssertablePublishedEvents events) {
        ActiveStudent first = activeStudent(students, invites, "Даня");
        ActiveStudent second = activeStudent(students, invites, "Дина");
        String login = uniqueLogin("father");
        Tokens father = activeGuardian(first.id(), "Павел", login);
        assertThat(link(second.id(), father.userId())).hasStatusOk();

        assertThat(unlink(first.id(), father.userId())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(events).contains(GuardianUnlinked.class).matching(GuardianUnlinked::studentId, first.id())
                .matching(GuardianUnlinked::deactivated, false);
        assertThat(get("/api/guardian/children", father.bearer())).hasStatusOk()
                .bodyJson().extractingPath("$[*].id").asArray().containsExactly(second.id().toString());

        assertThat(unlink(second.id(), father.userId())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(events).contains(GuardianUnlinked.class).matching(GuardianUnlinked::studentId, second.id())
                .matching(GuardianUnlinked::deactivated, true);
        assertThat(IdentityTestSupport.login(mvc, login, "father-password")).hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.deactivated");
        assertThat(mvc.post().uri("/api/auth/refresh").cookie(father.cookie())).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(unlink(second.id(), father.userId())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("guardian.not-found");

        assertThat(link(first.id(), father.userId())).hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("ACTIVE");
        assertThat(IdentityTestSupport.login(mvc, login, "father-password")).hasStatusOk();
    }

    @Test
    void aParentOfDeactivatedChildrenCannotSignIn() {
        ActiveStudent child = activeStudent(students, invites, "Тимур");
        String login = uniqueLogin("mother");
        Tokens mother = activeGuardian(child.id(), "Зарина", login);

        students.deactivate(child.id());
        assertThat(guardians.isGuardianOf(mother.userId(), child.id())).isFalse();
        assertThat(guardians.guardiansOf(child.id())).extracting(GuardianSummary::id).containsExactly(mother.userId());
        assertThat(IdentityTestSupport.login(mvc, login, "mother-password")).hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("identity.guardian-no-students");
        assertThat(mvc.post().uri("/api/auth/refresh").cookie(mother.cookie())).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(createGuardian(child.id(), "Второй")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("account.deactivated");

        students.reactivate(child.id());
        assertThat(IdentityTestSupport.login(mvc, login, "mother-password")).hasStatusOk();
    }

    @Test
    void theInvitationOfAParentOfDeactivatedChildrenIsRefused() {
        UUID child = students.create(Profile.named("Яна")).student().id();
        String token = JsonPath.read(body(createGuardian(child, "Отец")), "$.invite.token");
        students.deactivate(child);

        assertThat(mvc.get().uri("/api/auth/invites/" + token)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("identity.guardian-no-students");
        assertThat(accept(token, uniqueLogin("father"), "father-password"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void reissuesTheParentsLink() {
        UUID child = students.create(Profile.named("Ева")).student().id();
        MvcTestResult created = createGuardian(child, "Ольга");
        UUID olga = UUID.fromString(JsonPath.read(body(created), "$.guardian.id"));
        String first = JsonPath.read(body(created), "$.invite.token");

        MvcTestResult reissued = mvc.post().uri("/api/teacher/students/" + child + "/guardians/" + olga + "/invite")
                .header(HttpHeaders.AUTHORIZATION, teacher).exchange();
        assertThat(reissued).hasStatusOk().bodyJson().extractingPath("$.purpose").isEqualTo("ACTIVATION");
        assertThat(mvc.get().uri("/api/auth/invites/" + first)).hasStatus(HttpStatus.NOT_FOUND);
        accept(JsonPath.read(body(reissued), "$.token"), uniqueLogin("olga"), "olga-password");

        assertThat(mvc.post().uri("/api/teacher/students/" + child + "/guardians/" + olga + "/invite")
                .header(HttpHeaders.AUTHORIZATION, teacher)).hasStatusOk()
                .bodyJson().extractingPath("$.purpose").isEqualTo("PASSWORD_RESET");
        UUID other = students.create(Profile.named("Ян")).student().id();
        assertThat(mvc.post().uri("/api/teacher/students/" + other + "/guardians/" + olga + "/invite")
                .header(HttpHeaders.AUTHORIZATION, teacher)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void validatesTheName() {
        UUID child = students.create(Profile.named("Рита")).student().id();

        assertThat(createGuardian(child, " ")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(createGuardian(child, "x".repeat(101))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(createGuardian(UUID.randomUUID(), "Кто-то")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(get("/api/teacher/students/" + UUID.randomUUID() + "/guardians", teacher))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    private Tokens activeGuardian(UUID studentId, String name) {
        return activeGuardian(studentId, name, uniqueLogin("guardian"));
    }

    /** A guardian of the student who accepted the invitation; the password is {@code <login without suffix>-password}. */
    private Tokens activeGuardian(UUID studentId, String name, String login) {
        String token = JsonPath.read(body(createGuardian(studentId, name)), "$.invite.token");
        MvcTestResult accepted = accept(token, login, login.substring(0, login.lastIndexOf('-')) + "-password");
        assertThat(accepted).hasStatusOk();
        return tokens(accepted);
    }

    private MvcTestResult createGuardian(UUID studentId, String name) {
        return mvc.post().uri("/api/teacher/students/" + studentId + "/guardians")
                .header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"%s\"}".formatted(name))
                .exchange();
    }

    private MvcTestResult link(UUID studentId, UUID guardianId) {
        return mvc.post().uri("/api/teacher/students/" + studentId + "/guardians/link")
                .header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"guardianId\":\"%s\"}".formatted(guardianId))
                .exchange();
    }

    private MvcTestResult unlink(UUID studentId, UUID guardianId) {
        return mvc.delete().uri("/api/teacher/students/" + studentId + "/guardians/" + guardianId)
                .header(HttpHeaders.AUTHORIZATION, teacher)
                .exchange();
    }

    private MvcTestResult accept(String token, String login, String password) {
        return mvc.post().uri("/api/auth/invites/" + token + "/accept")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"%s\",\"password\":\"%s\"}".formatted(login, password))
                .exchange();
    }

    private MvcTestResult get(String uri, String bearer) {
        var request = mvc.get().uri(uri);
        if (bearer != null) {
            request.header(HttpHeaders.AUTHORIZATION, bearer);
        }
        return request.exchange();
    }
}
