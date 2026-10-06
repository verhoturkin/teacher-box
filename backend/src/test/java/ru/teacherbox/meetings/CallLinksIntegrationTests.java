package ru.teacherbox.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.identity.api.StudentDeactivated;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.meetings.api.MeetingRooms;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServer.Participant;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Links of the built-in rooms (ADR-0030) and taking users out of calls they lost. */
@MeetingsIntegrationTest
class CallLinksIntegrationTests {

    private static final String PORTAL = "https://school.example.org";

    @MockitoBean
    CallServer server;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MeetingRooms rooms;

    private final List<String> removed = new CopyOnWriteArrayList<>();
    private UUID anna;
    private UUID boris;
    private UUID group;

    @BeforeEach
    void setUp() {
        reset(server);
        removed.clear();
        when(server.enabled()).thenReturn(true);
        doAnswer(call -> removed.add(call.getArgument(0) + " " + call.getArgument(1))).when(server)
                .removeParticipant(anyString(), anyString());
        assertThat(teacher(mvc.put().uri("/api/teacher/portal"), "{\"address\":\"" + PORTAL + "\"}")).hasStatusOk();
        anna = directory.addStudent("Анна");
        boris = directory.addStudent("Борис");
        group = groups.addGroup("ОГЭ", anna, boris);
    }

    @AfterEach
    void forgetTheAddress() {
        teacher(mvc.put().uri("/api/teacher/portal"), "{}");
    }

    @Test
    void anOwnerWithoutAnExternalLinkGetsTheBuiltInRoom() {
        teacher(mvc.put().uri("/api/teacher/meetings/rooms"),
                "{\"studentId\":\"" + boris + "\",\"joinUrl\":\"https://zoom.us/j/1\"}");
        UUID gone = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);
        UUID archived = groups.addGroup("Архив");
        groups.archive(archived);

        assertThat(rooms.links(List.of(anna, boris, group, gone, archived, UUID.randomUUID()))).isEqualTo(Map.of(
                anna, PORTAL + "/call/" + anna,
                boris, "https://zoom.us/j/1",
                group, PORTAL + "/call/" + group));

        when(server.enabled()).thenReturn(false);
        assertThat(rooms.links(List.of(anna, boris))).isEqualTo(Map.of(boris, "https://zoom.us/j/1"));
    }

    @Test
    void theStudentAndTheBotGetTheLinkOfTheBuiltInRoom() {
        assertThat(mvc.get().uri("/api/me/meetings/rooms").with(TestUsers.student(anna))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[0].joinUrl").isEqualTo(PORTAL + "/call/" + anna);
                    assertThat(json).extractingPath("$[0].telemost").isEqualTo(false);
                    assertThat(json).extractingPath("$[1].groupName").isEqualTo("ОГЭ");
                    assertThat(json).extractingPath("$[1].joinUrl").isEqualTo(PORTAL + "/call/" + group);
                });
    }

    @Test
    void theTeacherSendsTheLinkOfTheBuiltInRoom(AssertablePublishedEvents events) {
        assertThat(share(group)).hasStatusOk().bodyJson().extractingPath("$.recipients").isEqualTo(2);
        assertThat(events).contains(MeetingLinkShared.class)
                .matching(MeetingLinkShared::joinUrl, PORTAL + "/call/" + group)
                .matching(MeetingLinkShared::groupId, group);
        assertThat(share(anna)).hasStatusOk();
        assertThat(events).contains(MeetingLinkShared.class)
                .matching(MeetingLinkShared::joinUrl, PORTAL + "/call/" + anna)
                .matching(event -> event.groupId() == null);

        assertThat(share(UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND);
        when(server.enabled()).thenReturn(false);
        assertThat(share(anna)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aDeactivatedStudentLeavesEveryCall(Scenario scenario) {
        when(server.occupiedRooms()).thenReturn(Map.of(
                "tb-" + anna, List.of(new Participant(anna.toString(), "Анна")),
                "tb-" + group, List.of(new Participant(anna.toString(), "Анна"),
                        new Participant(boris.toString(), "Борис"))));

        scenario.publish(new StudentDeactivated(anna, Instant.now()))
                .andWaitForStateChange(() -> removed.size(), size -> size == 2);

        assertThat(removed).containsExactlyInAnyOrder("tb-" + anna + " " + anna, "tb-" + group + " " + anna);
    }

    @Test
    void studentsRemovedFromAGroupAndAnArchivedGroupLeaveItsCall(Scenario scenario) {
        when(server.occupiedRooms()).thenReturn(Map.of(
                "tb-" + group, List.of(new Participant(anna.toString(), "Анна"),
                        new Participant(boris.toString(), "Борис")),
                "tb-" + boris, List.of(new Participant(boris.toString(), "Борис"))));

        scenario.publish(new GroupChanged(group, "ОГЭ", List.of(anna), List.of(), List.of(boris), Instant.now()))
                .andWaitForStateChange(() -> removed.size(), size -> size == 1);
        assertThat(removed).containsExactly("tb-" + group + " " + boris);

        removed.clear();
        scenario.publish(new GroupArchived(group, Instant.now()))
                .andWaitForStateChange(() -> removed.size(), size -> size == 2);
        assertThat(removed).containsExactlyInAnyOrder("tb-" + group + " " + anna, "tb-" + group + " " + boris);
    }

    @Test
    void nothingIsRemovedWhenNobodyLeftOrCallsAreOff(Scenario scenario) {
        scenario.publish(new GroupChanged(group, "ОГЭ", List.of(anna, boris), List.of(boris), List.of(),
                Instant.now())).andWaitForStateChange(() -> true);
        when(server.enabled()).thenReturn(false);
        scenario.publish(new StudentDeactivated(anna, Instant.now())).andWaitForStateChange(() -> true);
        verify(server, never()).occupiedRooms();

        when(server.enabled()).thenReturn(true);
        doThrow(new CallServerException("down")).when(server).occupiedRooms();
        scenario.publish(new GroupArchived(group, Instant.now())).andWaitForStateChange(() -> true);
        assertThat(removed).isEmpty();
    }

    private MvcTestResult share(UUID ownerId) {
        return teacher(mvc.post().uri("/api/teacher/meetings/rooms/" + ownerId + "/share"), "");
    }

    private MvcTestResult teacher(MockMvcTester.MockMvcRequestBuilder request, String json) {
        return request.with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
    }
}
