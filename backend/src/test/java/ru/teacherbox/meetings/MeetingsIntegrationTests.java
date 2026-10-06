package ru.teacherbox.meetings;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.meetings.api.MeetingRooms;
import ru.teacherbox.shared.reset.DataReset;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** External call links of students and groups. */
@MeetingsIntegrationTest
class MeetingsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MeetingRooms rooms;

    @Autowired
    List<DataReset> resets;

    @Test
    void theTeacherEntersLinks(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Вера");

        assertThat(put("/api/teacher/meetings/rooms",
                "{\"studentId\":\"" + student + "\",\"joinUrl\":\" https://zoom.us/j/7 \"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.joinUrl").isEqualTo("https://zoom.us/j/7");
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
    void groupLinksReachTheMembers(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Анна");
        UUID other = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", student, other);
        put("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\",\"joinUrl\":\"https://zoom.us/j/1\"}");

        assertThat(put("/api/teacher/meetings/rooms",
                "{\"groupId\":\"" + group + "\",\"joinUrl\":\"https://telemost.yandex.ru/j/2\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.ownerName").isEqualTo("ОГЭ");
                    assertThat(json).extractingPath("$.ownerType").isEqualTo("GROUP");
                    assertThat(json).extractingPath("$.telemost").isEqualTo(true);
                });
        assertThat(put("/api/teacher/meetings/rooms",
                "{\"groupId\":\"" + group + "\",\"joinUrl\":\"https://telemost.yandex.ru/j/3\"}")).hasStatusOk();
        assertThat(rooms.links(List.of(group))).as("a new link replaces the old one")
                .isEqualTo(Map.of(group, "https://telemost.yandex.ru/j/3"));

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
    void theTelemostApiIsGone() {
        UUID student = directory.addStudent("Галя");
        assertThat(post("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\"}"))
                .hasStatus(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(get("/api/teacher/meetings/yandex")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theFullResetForgetsTheLinks() {
        UUID student = directory.addStudent("Дина");
        put("/api/teacher/meetings/rooms", "{\"studentId\":\"" + student + "\",\"joinUrl\":\"https://zoom.us/j/9\"}");
        DataReset reset = resets.stream().filter(module -> module.tables().contains("meetings.rooms")).findFirst()
                .orElseThrow();

        reset.erase();

        assertThat(reset.tables()).containsExactly("meetings.rooms");
        assertThat(reset.afterErase()).isEmpty();
        assertThat(rooms.links(List.of(student))).isEmpty();
    }

    @Test
    void onlyTheTeacherManagesRooms() {
        UUID student = directory.addStudent("Любопытный");
        assertThat(mvc.get().uri("/api/teacher/meetings/rooms").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/meetings/rooms").with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
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
