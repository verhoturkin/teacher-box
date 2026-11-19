package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** A guardian reads a child's schedule as the child does and subscribes to all the children's lessons (ADR-0069). */
@ScheduleIntegrationTest
class GuardianScheduleIntegrationTests extends ScheduleHttpTestSupport {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    FakeGuardians guardians;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    @Test
    void aGuardianReadsTheChildsScheduleAsTheChildDoes() throws UnsupportedEncodingException {
        UUID child = directory.addStudent("Маша");
        UUID parent = guardians.addGuardian("Анна", child);
        Instant start = Slots.next(clock);
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(child, start, 60, true)));
        String base = "/api/guardian/students/" + child + "/schedule";
        LocalDate day = LocalDate.ofInstant(start, MOSCOW);

        assertThat(as(parent, base + "/settings")).hasStatusOk();
        assertThat(as(parent, base + "/summary")).hasStatusOk().bodyJson().extractingPath("$.next.id")
                .isEqualTo(lessonId);
        assertThat(as(parent, base + "/lessons?from=" + day + "&to=" + day.plusDays(1))).hasStatusOk()
                .bodyJson().extractingPath("$[0].id").isEqualTo(lessonId);
        assertThat(as(parent, base + "/lessons/" + lessonId)).hasStatusOk().bodyJson().extractingPath("$.id")
                .isEqualTo(lessonId);
        assertThat(as(parent, base + "/history")).hasStatusOk().bodyJson().extractingPath("$").asArray().isEmpty();
    }

    @Test
    void anotherStudentsScheduleIsNotFoundAndOtherRolesAreForbidden() throws UnsupportedEncodingException {
        UUID child = directory.addStudent("Свой");
        UUID stranger = directory.addStudent("Чужой");
        UUID parent = guardians.addGuardian("Родитель", child);
        String foreignLesson = id(post("/api/teacher/schedule/lessons", lesson(stranger, Slots.next(clock), 60, true)));
        String foreign = "/api/guardian/students/" + stranger + "/schedule";

        for (String path : new String[] {"/settings", "/summary", "/history", "/lessons/" + foreignLesson,
                "/lessons?from=2026-01-01&to=2026-01-02"}) {
            assertThat(as(parent, foreign + path)).hasStatus(HttpStatus.NOT_FOUND)
                    .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        }
        String own = "/api/guardian/students/" + child + "/schedule/summary";
        assertThat(mvc.get().uri(own).with(TestUsers.student(child))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(own).with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/guardian/schedule/feed").with(TestUsers.student(child)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/schedule/summary").with(TestUsers.guardian(parent)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void aDeactivatedChildIsHidden() {
        UUID child = directory.addStudent("Ушла");
        UUID parent = guardians.addGuardian("Мама", child);
        directory.setStatus(child, StudentStatus.DEACTIVATED);

        assertThat(as(parent, "/api/guardian/students/" + child + "/schedule/summary"))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theGuardianFeedHasEveryChildsLessonsWithTheirNames() throws UnsupportedEncodingException {
        UUID masha = directory.addStudent("Маша");
        UUID petya = directory.addStudent("Петя");
        UUID stranger = directory.addStudent("Посторонний");
        UUID parent = guardians.addGuardian("Анна", masha, petya);
        String mashaLesson = id(post("/api/teacher/schedule/lessons", lesson(masha, Slots.next(clock), 60, true)));
        String foreign = id(post("/api/teacher/schedule/lessons", lesson(stranger, Slots.next(clock), 60, true)));
        UUID group = groups.addGroup("Английский", masha, petya);
        String together = id(post("/api/teacher/schedule/lessons", """
                {"groupId":"%s","startsAt":"%s","allowOverlap":true}
                """.formatted(group, Slots.next(clock))));
        assertThat(mvc.get().uri("/api/guardian/schedule/feed").with(TestUsers.guardian(parent))).hasStatusOk()
                .bodyJson().extractingPath("$.enabled").isEqualTo(false);

        MvcTestResult created = mvc.post().uri("/api/guardian/schedule/feed").with(TestUsers.guardian(parent))
                .exchange();
        assertThat(created).hasStatusOk();
        String path = JsonPath.read(created.getResponse().getContentAsString(), "$.path");
        String ics = mvc.get().uri(path).exchange().getResponse().getContentAsString().replace("\r\n ", "");

        assertThat(ics).contains("X-WR-CALNAME:Занятия детей — ", "UID:" + mashaLesson + "@teacherbox",
                "SUMMARY:Маша — Занятие", "SUMMARY:Маша\\, Петя — Занятие группы «Английский»")
                .doesNotContain(foreign);
        assertThat(ics.split("UID:" + together, -1)).hasSize(2);
        assertThat(mvc.get().uri("/api/guardian/schedule/feed").with(TestUsers.guardian(parent))).hasStatusOk()
                .bodyJson().extractingPath("$.enabled").isEqualTo(true);

        directory.setStatus(masha, StudentStatus.DEACTIVATED);
        assertThat(mvc.get().uri(path).exchange().getResponse().getContentAsString()).doesNotContain(mashaLesson)
                .contains("SUMMARY:Петя — ");
        directory.setStatus(petya, StudentStatus.DEACTIVATED);
        assertThat(mvc.get().uri(path)).hasStatus(HttpStatus.NOT_FOUND);
        directory.setStatus(masha, StudentStatus.ACTIVE);
        directory.setStatus(petya, StudentStatus.ACTIVE);

        assertThat(mvc.delete().uri("/api/guardian/schedule/feed").with(TestUsers.guardian(parent)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri(path)).hasStatus(HttpStatus.NOT_FOUND);
    }

    private MvcTestResult as(UUID guardian, String uri) {
        return mvc.get().uri(uri).with(guardianUser(guardian)).exchange();
    }

    private static RequestPostProcessor guardianUser(UUID guardian) {
        return TestUsers.guardian(guardian);
    }
}
