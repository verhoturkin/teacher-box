package ru.teacherbox.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.meetings.api.CallSummoned;
import ru.teacherbox.meetings.application.CallServer;
import ru.teacherbox.meetings.application.CallServer.Participant;
import ru.teacherbox.meetings.application.CallServerException;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** «Позвать» (432.3): the teacher calls the students who are not in the built-in call yet. */
@MeetingsIntegrationTest
class CallSummonIntegrationTests {

    @MockitoBean
    CallServer server;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    private UUID anna;
    private UUID boris;
    private UUID group;
    private RequestPostProcessor teacher;

    @BeforeEach
    void setUp() {
        reset(server);
        when(server.enabled()).thenReturn(true);
        when(server.occupiedRooms()).thenReturn(Map.of());
        anna = directory.addStudent("Анна");
        boris = directory.addStudent("Борис");
        group = groups.addGroup("ОГЭ", anna, boris);
        teacher = TestUsers.teacher(directory.teacherId());
    }

    @Test
    void onlyTheTeacherSummons() {
        assertThat(summon(anna, TestUsers.student(anna))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(summon(group, TestUsers.student(boris))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(summon(anna, TestUsers.admin(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri(path(anna)).exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aStudentNotInTheCallGetsANoticeWithTheRoom(AssertablePublishedEvents events) {
        assertThat(summon(anna, teacher)).hasStatusOk().bodyJson().extractingPath("$.recipients").isEqualTo(1);

        assertThat(events).contains(CallSummoned.class).matching(CallSummoned::studentIds, List.of(anna))
                .matching(summoned -> summoned.groupId() == null);
        assertThat(events.ofType(NoticeRequested.class).matching(notice -> notice.recipientId().equals(anna)))
                .singleElement().satisfies(notice -> {
                    assertThat(notice.kind()).isEqualTo("CALL_SUMMONED");
                    assertThat(notice.link()).isEqualTo("/call/" + anna);
                    assertThat(notice.text(Language.RU).title()).isEqualTo("Урок начался");
                    assertThat(notice.text(Language.RU).body()).isEqualTo("Учитель ждёт вас в звонке.");
                });
    }

    @Test
    void aGroupSummonsOnlyThoseNotInTheCall(AssertablePublishedEvents events) {
        when(server.occupiedRooms()).thenReturn(Map.of("tb-" + group, List.of(
                new Participant(directory.teacherId().toString(), "Ольга"), new Participant(anna.toString(), "Анна"))));

        assertThat(summon(group, teacher)).hasStatusOk().bodyJson().extractingPath("$.recipients").isEqualTo(1);

        assertThat(events).contains(CallSummoned.class).matching(CallSummoned::studentIds, List.of(boris))
                .matching(CallSummoned::groupId, group);
        assertThat(events.ofType(NoticeRequested.class).matching(notice -> notice.recipientId().equals(boris)))
                .singleElement().satisfies(notice -> assertThat(notice.text(Language.RU).body())
                        .isEqualTo("Учитель ждёт вас в звонке группы «ОГЭ»."));
    }

    @Test
    void aStudentIsSummonedOncePerFewMinutes() {
        assertThat(summon(anna, teacher)).hasStatusOk();

        assertThat(summon(anna, teacher)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.summoned-recently");
        assertThat(summon(group, teacher)).as("the rest of the group is still called")
                .hasStatusOk().bodyJson().extractingPath("$.recipients").isEqualTo(1);
        clock.advance(Duration.ofMinutes(3));
        assertThat(summon(anna, teacher)).hasStatusOk();
    }

    @Test
    void nobodyToSummonWhenEveryoneIsInTheCall() {
        when(server.occupiedRooms()).thenReturn(Map.of("tb-" + anna, List.of(new Participant(anna.toString(), "Анна"))));

        assertThat(summon(anna, teacher)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.everyone-in-call");
    }

    @Test
    void noSummonsForAnExternalRoomAFormerStudentOrWithCallsOff() {
        mvc.put().uri("/api/teacher/meetings/rooms").with(teacher).contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"" + boris + "\",\"joinUrl\":\"https://telemost.yandex.ru/j/1\"}").exchange();
        assertThat(summon(boris, teacher)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.room-external");

        groups.archive(group);
        assertThat(summon(group, teacher)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(summon(UUID.randomUUID(), teacher)).hasStatus(HttpStatus.NOT_FOUND);

        when(server.occupiedRooms()).thenThrow(new CallServerException("down"));
        assertThat(summon(anna, teacher)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.call-server-unreachable");

        when(server.enabled()).thenReturn(false);
        assertThat(summon(anna, teacher)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.calls-disabled");
    }

    private MvcTestResult summon(UUID ownerId, RequestPostProcessor user) {
        return mvc.post().uri(path(ownerId)).with(user).exchange();
    }

    private static String path(UUID ownerId) {
        return "/api/teacher/meetings/calls/" + ownerId + "/summon";
    }
}
