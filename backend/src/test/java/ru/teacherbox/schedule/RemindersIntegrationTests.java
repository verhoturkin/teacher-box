package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.application.LessonReminders;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Reminders 24 hours and 1 hour before a lesson (configured in {@link ScheduleIntegrationTest}). */
@ScheduleIntegrationTest
class RemindersIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Autowired
    LessonReminders reminders;

    @Test
    void remindsOncePerAdvanceTime(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Помнит");
        Instant start = Slots.next(clock);
        String lessonId = plan(student, start);

        clock.advance(Duration.between(clock.instant(), start).minus(Duration.ofHours(23)));
        reminders.sendReminders();
        reminders.sendReminders();
        assertThat(reminders(events, lessonId)).singleElement().satisfies(reminder -> {
            assertThat(reminder.before()).isEqualTo(Duration.ofHours(24));
            assertThat(reminder.lastBefore()).isFalse();
        });

        clock.advance(Duration.ofHours(22).plusMinutes(30));
        reminders.sendReminders();

        assertThat(reminders(events, lessonId)).hasSize(2).last().satisfies(reminder -> {
            assertThat(reminder.before()).isEqualTo(Duration.ofHours(1));
            assertThat(reminder.lastBefore()).isTrue();
            assertThat(reminder.startsAt()).isEqualTo(start);
        });
    }

    @Test
    void aLessonPlannedShortlyBeforeGetsOnlyTheNearestReminder(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Срочно");
        String lessonId = plan(student, clock.instant().plus(Duration.ofMinutes(30)));

        reminders.sendReminders();
        reminders.sendReminders();

        assertThat(reminders(events, lessonId)).singleElement()
                .satisfies(reminder -> assertThat(reminder.before()).isEqualTo(Duration.ofHours(1)));
    }

    @Test
    void aMovedLessonIsRemindedAgain(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Перенёс");
        String lessonId = plan(student, clock.instant().plus(Duration.ofMinutes(40)));
        reminders.sendReminders();

        mvc.put().uri("/api/teacher/schedule/lessons/" + lessonId)
                .with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\":\"%s\",\"durationMinutes\":60,\"allowOverlap\":true}"
                        .formatted(clock.instant().plus(Duration.ofMinutes(50))))
                .exchange();
        reminders.sendReminders();

        assertThat(reminders(events, lessonId)).hasSize(2);
    }

    private String plan(UUID student, Instant start) throws UnsupportedEncodingException {
        return id(mvc.post().uri("/api/teacher/schedule/lessons")
                .with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(lesson(student, start, 60, true))
                .exchange());
    }

    private static List<LessonStartingSoon> reminders(AssertablePublishedEvents events, String lessonId) {
        return StreamSupport.stream(events.ofType(LessonStartingSoon.class)
                        .matching(event -> event.lessonId().toString().equals(lessonId)).spliterator(), false)
                .toList();
    }
}
