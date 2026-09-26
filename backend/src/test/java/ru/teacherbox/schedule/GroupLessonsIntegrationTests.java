package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.schedule.application.LessonReminders;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.testing.FakeMeetingRooms;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Lessons with a group of students (ADR-0011). */
@ScheduleIntegrationTest
class GroupLessonsIntegrationTests {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    FakeMeetingRooms rooms;

    @Autowired
    LessonRepository lessons;

    @Autowired
    MutableClock clock;

    @Autowired
    LessonReminders reminders;

    @Test
    void plansALessonForTheMembersOfAGroup(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);

        MvcTestResult result = post("/api/teacher/schedule/lessons", groupLesson(group, Slots.next(clock)));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.groupName").isEqualTo("ОГЭ");
            assertThat(json).extractingPath("$.studentId").isNull();
            assertThat(json).extractingPath("$.participants[*].studentName").asArray()
                    .containsExactly("Анна", "Борис");
            assertThat(json).extractingPath("$.participants[0].attendance").isEqualTo("EXPECTED");
        });
        assertThat(events).contains(LessonScheduled.class)
                .matching(LessonScheduled::groupId, group)
                .matching(LessonScheduled::studentIds, List.of(anna, boris));
        String lessonId = id(result);

        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lessonId).with(TestUsers.student(boris)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.groupName").isEqualTo("ОГЭ");
                    assertThat(json).extractingPath("$.participants[*].studentName").asArray()
                            .as("classmates are not shown").containsExactly("Борис");
                });
        UUID stranger = directory.addStudent("Чужой");
        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lessonId).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aLessonTakesPlaceInTheRoomOfItsStudentOrGroup() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Комнаты", anna);
        rooms.put(anna, "https://telemost.yandex.ru/j/111");
        rooms.put(group, "https://telemost.yandex.ru/j/222");

        String single = id(post("/api/teacher/schedule/lessons", LessonsIntegrationTests.lesson(anna, Slots.next(clock),
                60, true)));
        String own = id(post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","startsAt":"%s","meetingUrl":"https://zoom.us/j/9","allowOverlap":true}
                """.formatted(anna, Slots.next(clock))));

        assertThat(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.next(clock))))
                .bodyJson().extractingPath("$.joinUrl").isEqualTo("https://telemost.yandex.ru/j/222");
        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + single).with(TestUsers.student(anna))).bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.meetingUrl").isNull();
                    assertThat(json).extractingPath("$.joinUrl").isEqualTo("https://telemost.yandex.ru/j/111");
                });
        assertThat(mvc.get().uri("/api/teacher/schedule/lessons/" + own).with(teacher())).bodyJson()
                .extractingPath("$.joinUrl").isEqualTo("https://zoom.us/j/9");
    }

    @Test
    void checksTheGroupAndTheOwner() {
        UUID anna = directory.addStudent("Анна");
        UUID empty = groups.addGroup("Пустая");
        UUID archived = groups.addGroup("Архив", anna);
        groups.archive(archived);
        Instant start = Slots.next(clock);

        assertThat(post("/api/teacher/schedule/lessons", groupLesson(empty, start)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.group-empty");
        assertThat(post("/api/teacher/schedule/lessons", groupLesson(archived, start)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.group-not-found");
        assertThat(post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","groupId":"%s","startsAt":"%s","allowOverlap":true}
                """.formatted(anna, archived, start)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.owner-invalid");
        assertThat(post("/api/teacher/schedule/lessons", "{\"startsAt\":\"%s\"}".formatted(start)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void aGroupSeriesCreatesLessonsWithTheMembers(AssertablePublishedEvents events) {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Английский", anna);
        LocalDate first = LocalDate.ofInstant(clock.instant(), MOSCOW).plusDays(15);

        MvcTestResult result = post("/api/teacher/schedule/series", """
                {"groupId":"%s","weekdays":["%s"],"startTime":"06:00","startsOn":"%s","allowOverlap":true}
                """.formatted(group, first.getDayOfWeek(), first));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.series.groupName").isEqualTo("Английский");
            assertThat(json).extractingPath("$.series.studentId").isNull();
            assertThat(json).extractingPath("$.lessons").isEqualTo(2);
        });
        assertThat(events).contains(SeriesScheduled.class)
                .matching(SeriesScheduled::groupId, group)
                .matching(SeriesScheduled::studentIds, List.of(anna));
        String seriesId = JsonPath.read(body(result), "$.series.id");
        assertThat(lessonsOfGroup(group)).allSatisfy(lesson -> assertThat(lesson.studentIds()).containsExactly(anna));

        assertThat(put("/api/teacher/schedule/series/" + seriesId, """
                {"studentId":"%s","weekdays":["MONDAY"],"startTime":"06:00","startsOn":"%s","allowOverlap":true}
                """.formatted(anna, first)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.series-student-fixed");
    }

    @Test
    void marksTheAttendanceOfEveryParticipant(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID vera = directory.addStudent("Вера");
        UUID group = groups.addGroup("Олимпиада", anna, boris, vera);
        String lessonId = id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.past(clock))));

        assertThat(put("/api/teacher/schedule/lessons/" + lessonId + "/outcome", "{\"outcome\":\"CONDUCTED\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.attendance-required");
        assertThat(put("/api/teacher/schedule/lessons/" + lessonId + "/attendance", marks(anna, "ATTENDED")))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.attendance-invalid");

        assertThat(put("/api/teacher/schedule/lessons/" + lessonId + "/attendance",
                marks(anna, "ATTENDED", boris, "MISSED", vera, "EXCUSED")))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("CONDUCTED");
                    assertThat(json).extractingPath("$.participants[*].attendance").asArray()
                            .containsExactly("ATTENDED", "MISSED", "EXCUSED");
                });
        UUID lesson = UUID.fromString(lessonId);
        assertThat(events.ofType(LessonCompleted.class).matching(event -> event.lessonId().equals(lesson)))
                .extracting(LessonCompleted::studentId, LessonCompleted::missed, LessonCompleted::groupId)
                .containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple(anna, false, group),
                        org.assertj.core.groups.Tuple.tuple(boris, true, group));

        assertThat(put("/api/teacher/schedule/lessons/" + lessonId + "/attendance",
                marks(anna, "ATTENDED", boris, "EXCUSED", vera, "EXCUSED"))).hasStatusOk();
        assertThat(events).contains(LessonCompletionRevoked.class)
                .matching(LessonCompletionRevoked::lessonId, lesson)
                .matching(LessonCompletionRevoked::studentId, boris);
        assertThat(delete("/api/teacher/schedule/lessons/" + lessonId + "/outcome")).hasStatusOk()
                .bodyJson().extractingPath("$.participants[*].attendance").asArray()
                .containsExactly("EXPECTED", "EXCUSED", "EXCUSED");
    }

    @Test
    void aTimelyAbsenceIsAcceptedAtOnce(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("Физика", anna, boris);
        String lessonId = id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.next(clock))));

        assertThat(request(anna, lessonId, "{\"kind\":\"CANCEL\",\"comment\":\"Соревнования\"}"))
                .hasStatus(HttpStatus.CREATED)
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("APPROVED");
                    assertThat(json).extractingPath("$.groupName").isEqualTo("Физика");
                });
        assertThat(events).contains(LessonChangeRequested.class)
                .matching(LessonChangeRequested::studentId, anna)
                .matching(LessonChangeRequested::accepted, true);
        assertThat(lessons.findById(UUID.fromString(lessonId))).get()
                .extracting(Lesson::expectedIds).isEqualTo(List.of(boris));
        assertThat(request(anna, lessonId, "{\"kind\":\"CANCEL\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.participant-not-expected");
        assertThat(events.ofType(ScheduledLessonCancelled.class)
                .matching(event -> event.lessonId().toString().equals(lessonId))).isEmpty();
    }

    @Test
    void theTeacherDecidesOnALateAbsence(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Химия", anna, directory.addStudent("Борис"));
        Instant soon = clock.instant().truncatedTo(ChronoUnit.MINUTES).plus(Duration.ofHours(3));
        String lessonId = id(post("/api/teacher/schedule/lessons", groupLesson(group, soon)));

        MvcTestResult requested = request(anna, lessonId, "{\"kind\":\"CANCEL\"}");
        assertThat(requested).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("PENDING");
            assertThat(json).extractingPath("$.late").isEqualTo(true);
        });
        String requestId = id(requested);
        assertThat(mvc.get().uri("/api/teacher/schedule/lessons/" + lessonId).with(teacher()))
                .hasStatusOk().bodyJson().extractingPath("$.pendingRequests[0].id").isEqualTo(requestId);

        assertThat(post("/api/teacher/schedule/requests/" + requestId + "/approve", "{\"charge\":true}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").as("the others still come").isEqualTo("SCHEDULED");
                    assertThat(json).extractingPath("$.participants[0].attendance").isEqualTo("MISSED");
                });
        assertThat(events).contains(LessonCompleted.class)
                .matching(LessonCompleted::studentId, anna)
                .matching(LessonCompleted::groupId, group)
                .matching(LessonCompleted::missed, true);
        assertThat(events).contains(LessonChangeResolved.class)
                .matching(LessonChangeResolved::groupId, group)
                .matching(LessonChangeResolved::charged, true);

        assertThat(post("/api/teacher/schedule/lessons/" + lessonId + "/cancel", "{\"reason\":\"Болею\"}"))
                .hasStatusOk();
        assertThat(events).contains(LessonCompletionRevoked.class)
                .matching(LessonCompletionRevoked::studentId, anna);
        assertThat(events).contains(ScheduledLessonCancelled.class)
                .matching(ScheduledLessonCancelled::groupId, group);
    }

    @Test
    void anApprovedMoveMovesTheLessonForEverybody(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("Информатика", anna, boris);
        Instant start = Slots.next(clock);
        String lessonId = id(post("/api/teacher/schedule/lessons", groupLesson(group, start)));
        String move = id(request(anna, lessonId, "{\"kind\":\"RESCHEDULE\",\"proposedStartsAt\":\"%s\"}"
                .formatted(start.plus(Duration.ofDays(1)))));
        String other = id(request(boris, lessonId, "{\"kind\":\"RESCHEDULE\",\"proposedStartsAt\":\"%s\"}"
                .formatted(start.plus(Duration.ofDays(2)))));

        assertThat(post("/api/teacher/schedule/requests/" + move + "/approve", "{}")).hasStatusOk()
                .bodyJson().extractingPath("$.startsAt").isEqualTo(start.plus(Duration.ofDays(1)).toString());

        assertThat(events).contains(LessonRescheduled.class)
                .matching(LessonRescheduled::requestedBy, anna)
                .matching(LessonRescheduled::studentIds, List.of(anna, boris));
        assertThat(mvc.get().uri("/api/teacher/schedule/requests").with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$[*].id").asArray().as("the other request is outdated")
                .doesNotContain(move, other);
    }

    @Test
    void futureLessonsFollowTheMembersOfTheGroup(Scenario scenario) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID vera = directory.addStudent("Вера");
        UUID group = groups.addGroup("Шахматы", anna, boris);
        UUID future = UUID.fromString(id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.next(clock)))));
        UUID past = UUID.fromString(id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.past(clock)))));

        scenario.publish(new GroupChanged(group, "Шахматы", List.of(boris, vera), List.of(vera), List.of(anna),
                        Instant.now()))
                .andWaitForStateChange(() -> studentsOf(future), students -> students.contains(vera))
                .andVerify(students -> assertThat(students).containsExactly(boris, vera));
        assertThat(studentsOf(past)).as("past lessons stay as they were").containsExactly(anna, boris);
    }

    @Test
    void anArchivedGroupHasNoFutureLessons(Scenario scenario) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Летний лагерь", anna);
        LocalDate first = LocalDate.ofInstant(clock.instant(), MOSCOW).plusDays(16);
        assertThat(post("/api/teacher/schedule/series", """
                {"groupId":"%s","weekdays":["%s"],"startTime":"05:00","startsOn":"%s","allowOverlap":true}
                """.formatted(group, first.getDayOfWeek(), first))).hasStatus(HttpStatus.CREATED);
        UUID single = UUID.fromString(id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.next(clock)))));

        scenario.publish(new GroupArchived(group, Instant.now()))
                .andWaitForEventOfType(SeriesStopped.class)
                .matching(event -> group.equals(event.groupId()))
                .toArriveAndVerify(event -> assertThat(event.studentIds()).containsExactly(anna));

        assertThat(lessons.findById(single)).get().extracting(Lesson::status).isEqualTo(LessonStatus.CANCELLED);
        assertThat(lessonsOfGroup(group)).allSatisfy(lesson ->
                assertThat(lesson.status()).isEqualTo(LessonStatus.CANCELLED));
    }

    @Test
    void remindsOnlyTheStudentsWhoWillCome(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("Музыка", anna, boris);
        Instant start = clock.instant().truncatedTo(ChronoUnit.MINUTES).plus(Duration.ofMinutes(40));
        String lessonId = id(post("/api/teacher/schedule/lessons", groupLesson(group, start)));
        String absence = id(request(anna, lessonId, "{\"kind\":\"CANCEL\"}"));
        assertThat(post("/api/teacher/schedule/requests/" + absence + "/approve", "{}")).hasStatusOk();

        reminders.sendReminders();

        assertThat(events.ofType(LessonStartingSoon.class)
                .matching(event -> event.lessonId().toString().equals(lessonId)))
                .singleElement().satisfies(reminder -> {
                    assertThat(reminder.groupId()).isEqualTo(group);
                    assertThat(reminder.studentIds()).containsExactly(boris);
                });
    }

    @Test
    void calendarsNameTheGroup() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("Биология", anna);
        post("/api/teacher/schedule/lessons", groupLesson(group, Slots.next(clock)));

        assertThat(calendar(TestUsers.student(anna))).contains("SUMMARY:Занятие группы «Биология»");
        assertThat(calendar(teacher())).contains("SUMMARY:Урок: Биология");
    }

    private String calendar(RequestPostProcessor user) throws UnsupportedEncodingException {
        MvcTestResult created = mvc.post().uri("/api/me/schedule/feed").with(user).exchange();
        String path = JsonPath.read(body(created), "$.path");
        return mvc.get().uri(path).exchange().getResponse().getContentAsString().replace("\r\n ", "");
    }

    private List<Lesson> lessonsOfGroup(UUID group) {
        return lessons.findStartingBetween(clock.instant().minus(Duration.ofDays(400)),
                        clock.instant().plus(Duration.ofDays(400))).stream()
                .filter(lesson -> group.equals(lesson.groupId()))
                .toList();
    }

    private List<UUID> studentsOf(UUID lessonId) {
        return lessons.findById(lessonId).map(Lesson::studentIds).orElse(List.of());
    }

    private static String groupLesson(UUID group, Instant start) {
        return """
                {"groupId":"%s","startsAt":"%s","durationMinutes":90,"allowOverlap":true}
                """.formatted(group, start);
    }

    private static String marks(Object... pairs) {
        StringBuilder json = new StringBuilder("{\"marks\":{");
        for (int index = 0; index < pairs.length; index += 2) {
            json.append(index == 0 ? "" : ",").append('"').append(pairs[index]).append("\":\"")
                    .append(Attendance.valueOf(pairs[index + 1].toString())).append('"');
        }
        return json.append("}}").toString();
    }

    private static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString();
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private MvcTestResult request(UUID student, String lessonId, String json) {
        return mvc.post().uri("/api/me/schedule/lessons/" + lessonId + "/requests")
                .with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
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
