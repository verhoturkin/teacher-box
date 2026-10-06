package ru.teacherbox.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServer.Grant;
import ru.teacherbox.meetings.application.CallServer.Participant;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Built-in calls (ADR-0030): who may join which room; the media server is mocked. */
@MeetingsIntegrationTest
class CallsIntegrationTests {

    @MockitoBean
    CallServer server;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    private UUID anna;
    private UUID boris;
    private UUID group;

    @BeforeEach
    void setUp() {
        reset(server);
        when(server.enabled()).thenReturn(true);
        when(server.token(any())).thenAnswer(call -> "jwt-for-" + call.<Grant>getArgument(0).identity());
        anna = directory.addStudent("Анна");
        boris = directory.addStudent("Борис");
        group = groups.addGroup("ОГЭ", anna);
    }

    @Test
    void theTeacherJoinsTheRoomOfAStudentOrAGroupAsItsAdmin() {
        UUID teacher = directory.teacherId();

        assertThat(join(anna, TestUsers.teacher(teacher))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.token").isEqualTo("jwt-for-" + teacher);
            assertThat(json).extractingPath("$.room").isEqualTo("tb-" + anna);
            assertThat(json).extractingPath("$.title").isEqualTo("Анна");
        });
        verify(server).token(new Grant("tb-" + anna, teacher.toString(), "Учитель", true));
        assertThat(join(group, TestUsers.teacher(teacher))).hasStatusOk()
                .bodyJson().extractingPath("$.title").isEqualTo("ОГЭ");
    }

    @Test
    void aStudentJoinsTheirOwnRoomAndTheRoomsOfTheirGroups() {
        assertThat(join(anna, TestUsers.student(anna))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.room").isEqualTo("tb-" + anna);
            assertThat(json).extractingPath("$.title").isEqualTo("Урок");
        });
        verify(server).token(new Grant("tb-" + anna, anna.toString(), "Ученик", false));
        assertThat(join(group, TestUsers.student(anna))).hasStatusOk()
                .bodyJson().extractingPath("$.title").isEqualTo("ОГЭ");
    }

    @Test
    void anotherStudentGetsNotFound() {
        assertThat(join(anna, TestUsers.student(boris))).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.room-not-found");
        assertThat(join(group, TestUsers.student(boris))).hasStatus(HttpStatus.NOT_FOUND);
        verify(server, never()).token(any());
    }

    @Test
    void roomsOfFormerStudentsArchivedGroupsAndUnknownIdsDoNotExist() {
        UUID teacher = directory.teacherId();
        directory.setStatus(boris, StudentStatus.DEACTIVATED);
        groups.archive(group);

        assertThat(join(boris, TestUsers.teacher(teacher))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(join(group, TestUsers.teacher(teacher))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(join(group, TestUsers.student(anna))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(join(UUID.randomUUID(), TestUsers.teacher(teacher))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(join(boris, TestUsers.student(boris))).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theAdministratorHasNoCalls() {
        assertThat(join(anna, TestUsers.admin(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/meetings/calls/" + anna + "/token").exchange())
                .hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void callsAreOffWithoutTheMediaServer() {
        when(server.enabled()).thenReturn(false);

        assertThat(join(anna, TestUsers.teacher(directory.teacherId())))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.calls-disabled");
        verify(server, never()).token(any());
    }

    @Test
    void theTeacherSeesWhoIsInEachRoom() {
        UUID teacher = directory.teacherId();
        when(server.occupiedRooms()).thenReturn(Map.of(
                "tb-" + anna, List.of(new Participant(anna.toString(), "Анна")),
                "tb-" + group, List.of(new Participant(teacher.toString(), "Ольга"),
                        new Participant(anna.toString(), "Анна"))));
        mvc.put().uri("/api/teacher/meetings/rooms").with(TestUsers.teacher(teacher))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"" + boris + "\",\"joinUrl\":\"https://zoom.us/j/1\"}").exchange();

        assertThat(mvc.get().uri("/api/teacher/meetings/calls").with(TestUsers.teacher(teacher))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("OK");
                    assertThat(json).extractingPath(card(anna) + ".ownerType").asArray().containsExactly("STUDENT");
                    assertThat(json).extractingPath(card(anna) + ".waiting[0]").asArray().containsExactly("Анна");
                    assertThat(json).extractingPath(card(anna) + ".teacherPresent").asArray().containsExactly(false);
                    assertThat(json).extractingPath(card(boris) + ".externalLink").asArray().containsExactly(true);
                    assertThat(json).extractingPath(card(boris) + ".waiting.length()").asArray().containsExactly(0);
                    assertThat(json).extractingPath(card(group) + ".name").asArray().containsExactly("ОГЭ");
                    assertThat(json).extractingPath(card(group) + ".members").asArray().containsExactly(1);
                    assertThat(json).extractingPath(card(group) + ".teacherPresent").asArray().containsExactly(true);
                    assertThat(json).extractingPath(card(group) + ".waiting[0]").asArray().containsExactly("Анна");
                });
    }

    @Test
    void theRoomsAreListedWhenTheMediaServerIsDownOrOff() {
        UUID teacher = directory.teacherId();
        when(server.occupiedRooms()).thenThrow(new CallServerException("LiveKit ListRooms answered 503"));

        assertThat(mvc.get().uri("/api/teacher/meetings/calls").with(TestUsers.teacher(teacher))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("UNREACHABLE");
                    assertThat(json).extractingPath(card(anna) + ".name").asArray().containsExactly("Анна");
                });

        when(server.enabled()).thenReturn(false);
        assertThat(mvc.get().uri("/api/teacher/meetings/calls").with(TestUsers.teacher(teacher)))
                .bodyJson().extractingPath("$.status").isEqualTo("OFF");
        assertThat(mvc.get().uri("/api/teacher/meetings/calls").with(TestUsers.student(anna)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void aStudentSeesTheirRoomsAndWhetherTheTeacherIsThere() {
        when(server.occupiedRooms()).thenReturn(Map.of(
                "tb-" + group, List.of(new Participant(directory.teacherId().toString(), "Ольга"))));

        assertThat(mvc.get().uri("/api/me/meetings/calls").with(TestUsers.student(anna))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[0].ownerId").isEqualTo(anna.toString());
                    assertThat(json).extractingPath("$[0].title").isEqualTo("Урок");
                    assertThat(json).extractingPath("$[0].teacherPresent").isEqualTo(false);
                    assertThat(json).extractingPath("$[1].ownerId").isEqualTo(group.toString());
                    assertThat(json).extractingPath("$[1].title").isEqualTo("ОГЭ");
                    assertThat(json).extractingPath("$[1].teacherPresent").isEqualTo(true);
                });
        when(server.occupiedRooms()).thenThrow(new CallServerException("down"));
        assertThat(mvc.get().uri("/api/me/meetings/calls").with(TestUsers.student(anna))).hasStatusOk()
                .bodyJson().extractingPath("$[1].teacherPresent").isEqualTo(false);

        when(server.enabled()).thenReturn(false);
        assertThat(mvc.get().uri("/api/me/meetings/calls").with(TestUsers.student(anna))).hasStatusOk()
                .bodyJson().extractingPath("$.length()").isEqualTo(0);
        assertThat(mvc.get().uri("/api/me/meetings/calls").with(TestUsers.teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private static String card(UUID ownerId) {
        return "$.rooms[?(@.ownerId == '" + ownerId + "')]";
    }

    private MvcTestResult join(UUID ownerId, RequestPostProcessor user) {
        return mvc.post().uri("/api/meetings/calls/" + ownerId + "/token").with(user).exchange();
    }
}
