package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.body;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;

import com.jayway.jsonpath.JsonPath;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
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
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.identity.api.GroupCreated;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;

@IdentityIntegrationTest
class GroupIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Autowired
    StudentGroups directory;

    private String teacher;

    @BeforeEach
    void signInAsTeacher() {
        teacher = signInTeacher(mvc).bearer();
    }

    @Test
    void createsAGroup(AssertablePublishedEvents events) {
        UUID anna = student("Анна");
        UUID boris = student("Борис");

        MvcTestResult result = postJson("/api/teacher/groups",
                "{\"name\":\" ОГЭ 9 \",\"memberIds\":[\"%s\",\"%s\"]}".formatted(boris, anna));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.name").isEqualTo("ОГЭ 9");
            assertThat(json).extractingPath("$.members[*].displayName").asArray().containsExactly("Борис", "Анна");
            assertThat(json).extractingPath("$.members[0].status").isEqualTo("INVITED");
            assertThat(json).extractingPath("$.archivedAt").isNull();
            assertThat(json).extractingPath("$.version").isEqualTo(0);
        });
        UUID id = id(result);
        assertThat(events).contains(GroupCreated.class)
                .matching(GroupCreated::groupId, id)
                .matching(GroupCreated::memberIds, List.of(boris, anna));
        assertThat(get("/api/teacher/groups/" + id)).hasStatusOk().bodyJson().extractingPath("$.name").isEqualTo("ОГЭ 9");
        assertThat(directory.findGroup(id)).contains(new GroupSummary(id, "ОГЭ 9", List.of(boris, anna), false));
    }

    @Test
    void membersMustBeCurrentStudents() {
        UUID gone = student("Ушла");
        students.deactivate(gone);

        assertThat(postJson("/api/teacher/groups", "{\"name\":\"Г\",\"memberIds\":[\"%s\"]}".formatted(gone)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("group.member-invalid");
        assertThat(postJson("/api/teacher/groups",
                "{\"name\":\"Г\",\"memberIds\":[\"%s\"]}".formatted(UUID.randomUUID())))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(postJson("/api/teacher/groups", "{\"name\":\"\",\"memberIds\":[]}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().extractingPath("$.errors.name").isNotNull();
    }

    @Test
    void changesNameAndMembers(AssertablePublishedEvents events) {
        UUID anna = student("Анна");
        UUID boris = student("Борис");
        UUID vera = student("Вера");
        UUID id = create("Английский", anna, boris);

        MvcTestResult result = update(id, "Английский B1", 0, boris, vera);

        assertThat(result).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.name").isEqualTo("Английский B1");
            assertThat(json).extractingPath("$.members[*].id").asArray()
                    .containsExactly(boris.toString(), vera.toString());
            assertThat(json).extractingPath("$.version").isEqualTo(1);
        });
        assertThat(events).contains(GroupChanged.class)
                .matching(GroupChanged::groupId, id)
                .matching(GroupChanged::name, "Английский B1")
                .matching(GroupChanged::addedIds, List.of(vera))
                .matching(GroupChanged::removedIds, List.of(anna));
        assertThat(update(id, "Устаревшее", 0, boris)).hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("concurrent.modification");
    }

    @Test
    void anUnchangedGroupIsNotSavedAgain(AssertablePublishedEvents events) {
        UUID anna = student("Анна");
        UUID id = create("Без изменений", anna);

        assertThat(update(id, "Без изменений", 0, anna)).hasStatusOk()
                .bodyJson().extractingPath("$.version").isEqualTo(0);
        assertThat(events.ofType(GroupChanged.class).matching(event -> event.groupId().equals(id))).isEmpty();
    }

    @Test
    void archivesAndRestores(AssertablePublishedEvents events) {
        UUID id = create("Летняя школа", student("Анна"));

        assertThat(post("/api/teacher/groups/" + id + "/archive")).hasStatusOk()
                .bodyJson().extractingPath("$.archivedAt").isNotNull();
        assertThat(events).contains(GroupArchived.class).matching(GroupArchived::groupId, id);
        assertThat(post("/api/teacher/groups/" + id + "/archive")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("group.archived");
        assertThat(get("/api/teacher/groups")).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '%s')].archivedAt".formatted(id)).asArray().doesNotContainNull();

        assertThat(post("/api/teacher/groups/" + id + "/restore")).hasStatusOk()
                .bodyJson().extractingPath("$.archivedAt").isNull();
    }

    @Test
    void theDirectoryListsCurrentGroupsOfAStudent() {
        UUID anna = student("Анна");
        UUID current = create("Текущая", anna);
        UUID archived = create("Прошлогодняя", anna);
        post("/api/teacher/groups/" + archived + "/archive");

        assertThat(directory.groupsOf(anna)).extracting(GroupSummary::id).containsExactly(current);
        assertThat(directory.findGroups(List.of(current, archived, UUID.randomUUID())))
                .extracting(GroupSummary::archived).containsExactlyInAnyOrder(false, true);
        assertThat(directory.findGroups(List.of())).isEmpty();
        assertThat(directory.findGroup(UUID.randomUUID())).isEmpty();
    }

    @Test
    void aDeactivatedStudentLeavesTheGroups(AssertablePublishedEvents events) {
        UUID anna = student("Анна");
        UUID boris = student("Борис");
        UUID id = create("Пара", anna, boris);

        students.deactivate(anna);

        assertThat(directory.findGroup(id)).get().extracting(GroupSummary::memberIds).isEqualTo(List.of(boris));
        assertThat(events).contains(GroupChanged.class)
                .matching(GroupChanged::groupId, id)
                .matching(GroupChanged::removedIds, List.of(anna));
    }

    @Test
    void onlyTheTeacherManagesGroups() {
        ActiveStudent student = activeStudent(students, invites, "Любопытный");
        String bearer = signIn(mvc, student.login(), student.password()).bearer();

        assertThat(mvc.get().uri("/api/teacher/groups").header(HttpHeaders.AUTHORIZATION, bearer))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(get("/api/teacher/groups/" + UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("group.not-found");
    }

    private UUID student(String name) {
        return students.create(Profile.named(name)).student().id();
    }

    private UUID create(String name, UUID... members) {
        MvcTestResult result = postJson("/api/teacher/groups",
                "{\"name\":\"%s\",\"memberIds\":%s}".formatted(name, ids(members)));
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return id(result);
    }

    private MvcTestResult update(UUID id, String name, long version, UUID... members) {
        return mvc.put().uri("/api/teacher/groups/" + id)
                .header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"%s\",\"memberIds\":%s,\"version\":%d}".formatted(name, ids(members), version))
                .exchange();
    }

    private static String ids(UUID... ids) {
        return Arrays.stream(ids).map(id -> "\"" + id + "\"").collect(Collectors.joining(",", "[", "]"));
    }

    private static UUID id(MvcTestResult result) {
        return UUID.fromString(JsonPath.read(body(result), "$.id"));
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).header(HttpHeaders.AUTHORIZATION, teacher).exchange();
    }

    private MvcTestResult post(String uri) {
        return mvc.post().uri(uri).header(HttpHeaders.AUTHORIZATION, teacher).exchange();
    }

    private MvcTestResult postJson(String uri, String json) {
        return mvc.post().uri(uri)
                .header(HttpHeaders.AUTHORIZATION, teacher)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .exchange();
    }
}
