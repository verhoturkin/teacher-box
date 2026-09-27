package ru.teacherbox.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import org.springframework.web.util.UriComponentsBuilder;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.meetings.api.MeetingRooms;
import ru.teacherbox.meetings.application.TelemostApi;
import ru.teacherbox.meetings.application.TelemostAuthException;
import ru.teacherbox.meetings.application.TelemostException;
import ru.teacherbox.meetings.application.YandexService;
import ru.teacherbox.meetings.domain.YandexConnection;
import ru.teacherbox.meetings.persistence.YandexRepository;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Rooms of students and groups and the Yandex connection (the Telemost API itself is mocked). */
@MeetingsIntegrationTest
class MeetingsIntegrationTests {

    private static final String ORIGIN = "https://school.example.com";

    @MockitoBean
    TelemostApi telemost;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    @Autowired
    YandexService yandex;

    @Autowired
    MeetingRooms rooms;

    @Autowired
    List<IntegrationCheck> checks;

    private int meetings;

    @Autowired
    YandexRepository connections;

    @BeforeEach
    void startDisconnected() {
        connections.save(YandexConnection.none(clock.instant()));
        clearInvocations(telemost);
        when(telemost.authorizationUrl(anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(call -> "https://oauth.yandex.ru/authorize?state=" + call.getArgument(2));
        when(telemost.exchangeCode(any(), eq("code-1")))
                .thenReturn(new TelemostApi.Tokens("access-1", 3600, "refresh-1"));
        when(telemost.createConference(anyString(), anyString())).thenAnswer(call -> {
            meetings++;
            return new TelemostApi.Conference(String.valueOf(meetings), "https://telemost.yandex.ru/j/" + meetings);
        });
    }

    @Test
    void theTeacherConnectsYandex() {
        assertThat(get("/api/teacher/meetings/yandex")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("NOT_CONNECTED");
            assertThat(json).extractingPath("$.callbackPath").isEqualTo("/api/public/meetings/yandex/callback");
        });
        assertThat(post("/api/teacher/meetings/yandex/authorize", "{\"origin\":\"" + ORIGIN + "\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.client-missing");
        assertThat(put("/api/teacher/meetings/yandex/client", "{\"clientId\":\" id-1 \",\"clientSecret\":\"secret\"}"))
                .hasStatusOk().bodyJson().extractingPath("$.clientId").isEqualTo("id-1");

        String state = authorize();
        verify(telemost).authorizationUrl("id-1", ORIGIN + "/api/public/meetings/yandex/callback", state,
                "teacherbox-id1");
        assertThat(callback(state, "code-1", null)).isEqualTo("/teacher/settings?tab=meetings&yandex=connected");

        assertThat(get("/api/teacher/meetings/yandex")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("CONNECTED");
            assertThat(json).extractingPath("$.connectedAt").isNotNull();
        });
        assertThat(callback(state, "code-1", null)).as("a state is used once")
                .isEqualTo("/teacher/settings?tab=meetings&yandex=expired");
    }

    @Test
    void theAuthorizationCanFail() {
        yandex.saveClient("id-1", "secret");
        assertThat(callback(authorize(), null, "access_denied")).endsWith("yandex=denied");
        assertThat(callback("short", "code-1", null)).endsWith("yandex=expired");
        assertThat(callback(null, "code-1", null)).endsWith("yandex=expired");

        when(telemost.exchangeCode(any(), eq("bad"))).thenThrow(new TelemostException("Yandex token 400"));
        assertThat(callback(authorize(), "bad", null)).endsWith("yandex=failed");
        assertThat(get("/api/teacher/meetings/yandex")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("NOT_CONNECTED");
            assertThat(json).extractingPath("$.lastError").isEqualTo("Yandex token 400");
        });
        assertThat(post("/api/teacher/meetings/yandex/authorize", "{\"origin\":\"ftp://x\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.origin-invalid");
    }

    @Test
    void roomsAreCreatedThroughTheApi(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Анна");
        UUID other = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", student, other);

        assertThat(post("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.not-connected");
        connect();
        put("/api/teacher/meetings/yandex/waiting-room", "{\"enabled\":true}");

        assertThat(post("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.ownerName").isEqualTo("Анна");
                    assertThat(json).extractingPath("$.ownerType").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$.source").isEqualTo("API");
                    assertThat(json).extractingPath("$.telemost").isEqualTo(true);
                });
        verify(telemost, atLeastOnce()).createConference("access-1", "ADMINS");
        assertThat(post("/api/teacher/meetings/rooms", "{\"groupId\":\"" + group + "\"}")).hasStatusOk();
        String studentLink = rooms.links(List.of(student)).get(student);
        assertThat(post("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\"}")).hasStatusOk();
        assertThat(rooms.links(List.of(student)).get(student)).as("a new meeting replaces the room")
                .isNotEqualTo(studentLink);

        assertThat(get("/api/teacher/meetings/rooms")).bodyJson()
                .extractingPath("$[?(@.ownerId == '" + group + "')].ownerName").asArray().containsExactly("ОГЭ");
        assertThat(post("/api/teacher/meetings/rooms/" + group + "/share", "")).hasStatusOk()
                .bodyJson().extractingPath("$.recipients").isEqualTo(2);
        assertThat(events).contains(MeetingLinkShared.class)
                .matching(MeetingLinkShared::groupId, group)
                .matching(MeetingLinkShared::studentIds, List.of(student, other));

        assertThat(mvc.get().uri("/api/me/meetings/rooms").with(TestUsers.student(student))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[0].ownerType").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$[1].groupName").isEqualTo("ОГЭ");
                });
    }

    @Test
    void theTeacherEntersLinksWithoutYandex(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Вера");

        assertThat(put("/api/teacher/meetings/rooms",
                "{\"studentId\":\"" + student + "\",\"joinUrl\":\" https://zoom.us/j/7 \"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.joinUrl").isEqualTo("https://zoom.us/j/7");
                    assertThat(json).extractingPath("$.source").isEqualTo("MANUAL");
                    assertThat(json).extractingPath("$.telemost").isEqualTo(false);
                });
        assertThat(rooms.links(List.of(student, UUID.randomUUID()))).isEqualTo(Map.of(student, "https://zoom.us/j/7"));
        assertThat(post("/api/teacher/meetings/rooms/" + student + "/share", "")).hasStatusOk();
        assertThat(events).contains(MeetingLinkShared.class)
                .matching(MeetingLinkShared::studentIds, List.of(student))
                .matching(event -> event.groupId() == null);

        assertThat(put("/api/teacher/meetings/rooms",
                "{\"studentId\":\"" + student + "\",\"joinUrl\":\"zoom\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.link-invalid");
        assertThat(delete("/api/teacher/meetings/rooms/" + student)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(delete("/api/teacher/meetings/rooms/" + student)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(post("/api/teacher/meetings/rooms/" + student + "/share", "")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void checksOwnersAndRecipients() {
        UUID gone = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);
        UUID archived = groups.addGroup("Архив");
        groups.archive(archived);

        assertThat(put("/api/teacher/meetings/rooms", "{\"studentId\":\"" + gone + "\",\"joinUrl\":\"https://x.ru\"}"))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("meetings.student-not-found");
        assertThat(put("/api/teacher/meetings/rooms", "{\"groupId\":\"" + archived + "\",\"joinUrl\":\"https://x.ru\"}"))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("meetings.group-not-found");
        assertThat(put("/api/teacher/meetings/rooms", "{\"joinUrl\":\"https://x.ru\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.owner-invalid");

        UUID leaving = directory.addStudent("Уходит");
        put("/api/teacher/meetings/rooms", "{\"studentId\":\"" + leaving + "\",\"joinUrl\":\"https://x.ru\"}");
        directory.setStatus(leaving, StudentStatus.DEACTIVATED);
        assertThat(post("/api/teacher/meetings/rooms/" + leaving + "/share", "")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.no-recipients");
    }

    @Test
    void aRevokedConnectionAsksToReconnect() {
        UUID student = directory.addStudent("Глеб");
        connect();
        when(telemost.createConference(anyString(), anyString())).thenThrow(new TelemostAuthException("401"));

        assertThat(post("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.reconnect");
        assertThat(get("/api/teacher/meetings/yandex")).bodyJson().extractingPath("$.status")
                .isEqualTo("NEEDS_RECONNECT");

        connect();
        doThrow(new TelemostException("503")).when(telemost).createConference(anyString(), anyString());
        assertThat(post("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("meetings.telemost-failed");
    }

    @Test
    void anExpiringTokenIsRefreshed() {
        connect();
        when(telemost.refresh(any(), eq("refresh-1"))).thenReturn(new TelemostApi.Tokens("access-2", 3600, null));
        clock.advance(Duration.ofMinutes(58));

        assertThat(yandex.accessToken()).isEqualTo("access-2");
        assertThat(yandex.accessToken()).as("the new token is kept").isEqualTo("access-2");

        clock.advance(Duration.ofMinutes(58));
        when(telemost.refresh(any(), eq("refresh-1"))).thenThrow(new TelemostAuthException("invalid_grant"));
        org.assertj.core.api.Assertions.assertThatThrownBy(yandex::accessToken)
                .isInstanceOf(TelemostAuthException.class);
        assertThat(yandex.status().status().name()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void disconnectingRevokesTheToken() {
        connect();
        doThrow(new TelemostException("offline")).when(telemost).revoke(any(), eq("access-1"));

        assertThat(delete("/api/teacher/meetings/yandex")).hasStatus(HttpStatus.NO_CONTENT);

        verify(telemost).revoke(new TelemostApi.Client("id-1", "secret"), "access-1");
        assertThat(yandex.canCreateMeetings()).isFalse();
    }

    @Test
    void theAdministratorChecksTheToken() {
        IntegrationCheck check = checks.stream()
                .filter(candidate -> candidate.getClass().getSimpleName().equals("TelemostIntegrationCheck"))
                .findFirst().orElseThrow();
        assertThat(check.check().getFirst().state()).isEqualTo(IntegrationCheck.State.NOT_CONFIGURED);

        connect();
        assertThat(check.check().getFirst().state()).isEqualTo(IntegrationCheck.State.OK);
        verify(telemost).checkToken("access-1");

        doThrow(new TelemostException("timeout")).when(telemost).checkToken("access-1");
        assertThat(check.check().getFirst().detail()).isEqualTo("timeout");
        doThrow(new TelemostAuthException("401")).when(telemost).checkToken("access-1");
        assertThat(check.check().getFirst().state()).isEqualTo(IntegrationCheck.State.FAILED);
        assertThat(yandex.canCreateMeetings()).isFalse();
    }

    @Test
    void onlyTheTeacherManagesRooms() {
        UUID student = directory.addStudent("Любопытный");
        assertThat(mvc.get().uri("/api/teacher/meetings/rooms").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/meetings/rooms").with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        verify(telemost, never()).createConference(anyString(), anyString());
    }

    private void connect() {
        yandex.saveClient("id-1", "secret");
        when(telemost.exchangeCode(any(), eq("code-1")))
                .thenReturn(new TelemostApi.Tokens("access-1", 3600, "refresh-1"));
        assertThat(callback(authorize(), "code-1", null)).endsWith("yandex=connected");
    }

    private String authorize() {
        MvcTestResult result = post("/api/teacher/meetings/yandex/authorize", "{\"origin\":\"" + ORIGIN + "/teacher\"}");
        assertThat(result).hasStatusOk();
        String url = com.jayway.jsonpath.JsonPath.read(body(result), "$.url");
        return UriComponentsBuilder.fromUriString(url).build().getQueryParams().getFirst("state");
    }

    private String callback(String state, String code, String error) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/api/public/meetings/yandex/callback");
        if (state != null) {
            uri.queryParam("state", state);
        }
        if (code != null) {
            uri.queryParam("code", code);
        }
        if (error != null) {
            uri.queryParam("error", error);
        }
        MvcTestResult result = mvc.get().uri(uri.build().toUriString()).exchange();
        assertThat(result).hasStatus(HttpStatus.FOUND);
        return result.getResponse().getHeader("Location");
    }

    private static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString();
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).with(teacher()).exchange();
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult delete(String uri) {
        return mvc.delete().uri(uri).with(teacher()).exchange();
    }
}
