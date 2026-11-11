package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonDeleted;
import ru.teacherbox.schedule.api.LessonRepeatScheduled;
import ru.teacherbox.schedule.api.LessonRepeatStopped;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonRestored;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.LessonSummaryShared;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/**
 * Schedule events become notices for the student and the teacher (Moscow time), published in the
 * transaction of the event (ADR-0061).
 */
@ScheduleIntegrationTest
class ScheduleNoticesIntegrationTests {

    /** Thursday, 01.10.2026 18:00 in Moscow. */
    private static final Instant START = Instant.parse("2026-10-01T15:00:00Z");
    /** Friday, 02.10.2026 19:30 in Moscow. */
    private static final Instant LATER = Instant.parse("2026-10-02T16:30:00Z");
    /** A moment before both lessons: only upcoming lessons are announced. */
    private static final Instant EARLIER = Instant.parse("2026-09-30T09:00:00Z");

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    ApplicationEventPublisher publisher;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    MutableClock clock;

    @Test
    void newLessonsAndSeries(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Новичок");
        NoticeRequested single = latest(events, student,
                new LessonScheduled(UUID.randomUUID(), null, List.of(student), START, 60, "Английский", "Дроби", Instant.now()));
        assertThat(single.kind()).isEqualTo("SCHEDULE_LESSON_PLANNED");
        assertThat(ru(single).title()).isEqualTo("Новое занятие: четверг, 01.10 в 18:00");
        assertThat(ru(single).body()).isEqualTo("Занятие «Английский». Тема: Дроби.");
        assertThat(single.link()).isEqualTo("/cabinet/schedule");
        assertThat(single.subject()).isNull();
        assertThat(single.joinUrl()).isNull();

        UUID regular = directory.addStudent("Регулярный");
        NoticeRequested series = latest(events, regular, new LessonRepeatScheduled(UUID.randomUUID(), null, List.of(regular),
                List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY), LocalTime.of(18, 0), 60, 2,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), Instant.now()));
        assertThat(ru(series).title()).isEqualTo("Занятия с повтором по вторникам и четвергам в 18:00");
        assertThat(ru(series).body()).isEqualTo("С 01.10.2026 по 31.12.2026, раз в 2 недели.");

        UUID weekly = directory.addStudent("Каждую неделю");
        assertThat(ru(latest(events, weekly, new LessonRepeatScheduled(UUID.randomUUID(), null, List.of(weekly), List.of(DayOfWeek.MONDAY),
                LocalTime.of(9, 0), 60, 1, LocalDate.of(2026, 10, 5), null, Instant.now()))).body())
                .isEqualTo("С 05.10.2026.");
    }

    @Test
    void stoppedSeriesAreAnnouncedUnlessReplaced(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Каникулы");
        publish(new LessonRepeatStopped(UUID.randomUUID(), null, List.of(student), LocalDate.of(2026, 10, 5), true,
                Instant.now()));
        assertThat(notices(events, student)).isEmpty();

        NoticeRequested stopped = latest(events, student, new LessonRepeatStopped(UUID.randomUUID(), null, List.of(student),
                LocalDate.of(2026, 10, 5), false, Instant.now()));
        assertThat(stopped.kind()).isEqualTo("SCHEDULE_LESSON_CANCELLED");
        assertThat(ru(stopped).body()).isEqualTo("Занятия по расписанию с 05.10.2026 отменены.");
    }

    @Test
    void movesAndCancellationsByTheTeacher(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Перенос");
        NoticeRequested moved = latest(events, student, new LessonRescheduled(UUID.randomUUID(), null, List.of(student), START,
                LATER, 60, null, Instant.now()));
        assertThat(moved.kind()).isEqualTo("SCHEDULE_LESSON_MOVED");
        assertThat(ru(moved).title()).isEqualTo("Занятие перенесено на пятница, 02.10 в 19:30");
        assertThat(ru(moved).body()).isEqualTo("Было: четверг, 01.10 в 18:00.");

        UUID cancelled = directory.addStudent("Отмена");
        NoticeRequested byTeacher = latest(events, cancelled, new ScheduledLessonCancelled(UUID.randomUUID(),
                null, List.of(cancelled), START, CancelledBy.STUDENT, "Заболел", true, false, Instant.now()));
        assertThat(ru(byTeacher).title()).isEqualTo("Занятие четверг, 01.10 в 18:00 отменено");
        assertThat(ru(byTeacher).body()).isEqualTo("Причина: Заболел Занятие засчитано как пропуск.");

        UUID quiet = directory.addStudent("Без причины");
        assertThat(ru(latest(events, quiet, new ScheduledLessonCancelled(UUID.randomUUID(), null, List.of(quiet), START,
                CancelledBy.TEACHER, null, false, false, Instant.now()))).body()).isNull();
    }

    @Test
    void aDeletedLessonIsCancelledForTheStudentsAndARestoredOneIsBack(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Удалено");
        NoticeRequested deleted = latest(events, student,
                new LessonDeleted(UUID.randomUUID(), null, List.of(student), START, true, EARLIER));
        assertThat(deleted.kind()).isEqualTo("SCHEDULE_LESSON_CANCELLED");
        assertThat(ru(deleted).title()).isEqualTo("Занятие четверг, 01.10 в 18:00 отменено");
        assertThat(ru(deleted).body()).isNull();

        UUID back = directory.addStudent("Снова в расписании");
        NoticeRequested restored = latest(events, back,
                new LessonRestored(UUID.randomUUID(), null, List.of(back), LATER, 60, EARLIER));
        assertThat(restored.kind()).isEqualTo("SCHEDULE_LESSON_PLANNED");
        assertThat(ru(restored).title()).isEqualTo("Занятие пятница, 02.10 в 19:30 снова в расписании");
        assertThat(ru(restored).body()).isEqualTo("Отмена занятия снята.");

        UUID quiet = directory.addStudent("Не узнает");
        publish(new LessonDeleted(UUID.randomUUID(), null, List.of(quiet), START, false, EARLIER));
        publish(new LessonDeleted(UUID.randomUUID(), null, List.of(quiet), START, true, LATER));
        publish(new LessonRestored(UUID.randomUUID(), null, List.of(quiet), START, 60, LATER));
        assertThat(notices(events, quiet)).isEmpty();
    }

    @Test
    void changesByRequestAreAnnouncedOnceByTheAnswer(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("По просьбе");
        publish(new LessonRescheduled(UUID.randomUUID(), null, List.of(student), START, LATER, 60, student, Instant.now()));
        publish(new ScheduledLessonCancelled(UUID.randomUUID(), null, List.of(student), START, CancelledBy.STUDENT, null,
                false, true, Instant.now()));
        assertThat(notices(events, student)).isEmpty();

        NoticeRequested approvedMove = latest(events, student, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), student, null, ChangeKind.RESCHEDULE, true, LATER, false, "Договорились",
                Instant.now()));
        assertThat(approvedMove.kind()).isEqualTo("SCHEDULE_REQUEST_ANSWERED");
        assertThat(ru(approvedMove).title()).isEqualTo("Перенос согласован: пятница, 02.10 в 19:30");
        assertThat(ru(approvedMove).body()).isEqualTo("Комментарий учителя: Договорились");

        UUID late = directory.addStudent("Поздно");
        NoticeRequested charged = latest(events, late, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), late, null, ChangeKind.CANCEL, true, START, true, null, Instant.now()));
        assertThat(ru(charged).title()).isEqualTo("Отмена занятия четверг, 01.10 в 18:00 согласована");
        assertThat(ru(charged).body()).isEqualTo("Отмена поздняя, занятие засчитано как пропуск.");

        UUID declinedMove = directory.addStudent("Отказ переноса");
        assertThat(ru(latest(events, declinedMove, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(),
                declinedMove, null, ChangeKind.RESCHEDULE, false, START, false, null, Instant.now()))).title())
                .isEqualTo("Перенос занятия не согласован");
        UUID declinedCancel = directory.addStudent("Отказ отмены");
        NoticeRequested declined = latest(events, declinedCancel, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), declinedCancel, null, ChangeKind.CANCEL, false, START, false, null, Instant.now()));
        assertThat(ru(declined).title()).isEqualTo("Отмена занятия не согласована");
        assertThat(ru(declined).body()).isEqualTo("Занятие остаётся: четверг, 01.10 в 18:00.");
    }

    @Test
    void requestsGoToTheTeacher(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Просит");
        UUID lesson = UUID.randomUUID();

        publish(new LessonChangeRequested(UUID.randomUUID(), lesson, student, null, ChangeKind.RESCHEDULE, START,
                LATER, "Можно позже?", false, false, Instant.now()));
        assertThat(teacherNotices(events, "Просит просит перенести занятие")).singleElement().satisfies(notice -> {
            assertThat(notice.kind()).isEqualTo("SCHEDULE_REQUEST");
            assertThat(ru(notice).body()).isEqualTo("Занятие: четверг, 01.10 в 18:00. "
                    + "Предлагает: пятница, 02.10 в 19:30. Комментарий: Можно позже?");
            assertThat(notice.link()).isEqualTo("/teacher/schedule");
        });

        UUID late = directory.addStudent("Отменяет поздно");
        publish(new LessonChangeRequested(UUID.randomUUID(), lesson, late, null, ChangeKind.CANCEL, START, null,
                null, true, false, Instant.now()));
        assertThat(teacherNotices(events, "Отменяет поздно просит отменить занятие")).singleElement()
                .satisfies(notice -> assertThat(ru(notice).body())
                        .isEqualTo("Занятие: четверг, 01.10 в 18:00. Поздняя отмена."));
    }

    @Test
    void remindersGoToTheStudentAndTheLastOneToTheTeacher(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Напомнить");
        NoticeRequested early = latest(events, student, new LessonStartingSoon(UUID.randomUUID(), null, List.of(student), START,
                60, null, null, null, Duration.ofHours(24), false, Instant.now()));
        assertThat(early.kind()).isEqualTo("SCHEDULE_REMINDER");
        assertThat(ru(early).title()).isEqualTo("Скоро занятие: четверг, 01.10 в 18:00");
        assertThat(ru(early).body()).isEqualTo("Через 24 часа.");
        assertThat(early.joinUrl()).isNull();
        assertThat(teacherNotices(events, "Скоро урок: Напомнить, четверг, 01.10 в 18:00")).isEmpty();

        UUID last = directory.addStudent("Последнее");
        publish(new LessonStartingSoon(UUID.randomUUID(), null, List.of(last), START, 60, null, "Дроби",
                "https://zoom.us/j/1", Duration.ofHours(1), true, Instant.now()));
        assertThat(teacherNotices(events, "Скоро урок: Последнее, четверг, 01.10 в 18:00")).singleElement()
                .satisfies(notice -> {
                    assertThat(ru(notice).body()).isEqualTo("Через 1 час. Ссылка на урок: https://zoom.us/j/1");
                    assertThat(ru(notice).roomBody()).isEqualTo("Через 1 час.");
                    assertThat(notice.joinUrl()).isEqualTo("https://zoom.us/j/1");
                });
        assertThat(notices(events, last)).singleElement().satisfies(notice -> {
            assertThat(ru(notice).body()).isEqualTo("Через 1 час. Тема: Дроби. Ссылка на урок: https://zoom.us/j/1");
            assertThat(ru(notice).roomBody()).as("the address goes as a button").isEqualTo("Через 1 час. Тема: Дроби.");
            assertThat(notice.joinUrl()).isEqualTo("https://zoom.us/j/1");
        });
    }

    @Test
    void everyNoticeIsWrittenInEnglishToo(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Newcomer");
        NoticeText single = en(latest(events, student,
                new LessonScheduled(UUID.randomUUID(), null, List.of(student), START, 60, null, "Fractions", Instant.now())));
        assertThat(single.title()).isEqualTo("New lesson: Thursday, 01.10 at 18:00");
        assertThat(single.body()).isEqualTo("Topic: Fractions.");

        UUID regular = directory.addStudent("Regular");
        NoticeText series = en(latest(events, regular, new LessonRepeatScheduled(UUID.randomUUID(), null,
                List.of(regular), List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY), LocalTime.of(18, 0), 60, 2,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), Instant.now())));
        assertThat(series.title()).isEqualTo("Recurring lessons on Tuesdays and Thursdays at 18:00");
        assertThat(series.body()).isEqualTo("From 01.10.2026 to 31.12.2026, every 2 weeks.");

        UUID reminded = directory.addStudent("Reminded");
        NoticeText soon = en(latest(events, reminded, new LessonStartingSoon(UUID.randomUUID(), null,
                List.of(reminded), START, 60, "Maths", "Fractions", "https://zoom.us/j/1", Duration.ofHours(24), false,
                Instant.now())));
        assertThat(soon.title()).isEqualTo("Upcoming lesson: Thursday, 01.10 at 18:00");
        assertThat(soon.body()).isEqualTo("In 24 hours. Lesson “Maths”. Topic: Fractions. Lesson link: https://zoom.us/j/1");

        UUID asks = directory.addStudent("Asks");
        publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), asks, null,
                ChangeKind.RESCHEDULE, START, LATER, "Later?", false, false, Instant.now()));
        assertThat(notices(events, directory.teacherId()))
                .filteredOn(notice -> en(notice).title().equals("Asks requested a lesson reschedule"))
                .singleElement().satisfies(notice -> assertThat(en(notice).body()).isEqualTo(
                        "Lesson: Thursday, 01.10 at 18:00. Suggested time: Friday, 02.10 at 19:30. Comment: Later?"));
    }

    @Test
    void groupLessonsReachEveryParticipant(AssertablePublishedEvents events) {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);

        publish(new LessonScheduled(UUID.randomUUID(), group, List.of(anna, boris), START, 90, null, null,
                Instant.now()));
        assertThat(notices(events, boris)).singleElement()
                .satisfies(notice -> assertThat(ru(notice).body()).isEqualTo("Группа «ОГЭ»."));
        assertThat(notices(events, anna)).hasSize(1);

        publish(new LessonRescheduled(UUID.randomUUID(), group, List.of(anna, boris), START, LATER, 90, anna,
                Instant.now()));
        assertThat(notices(events, boris)).hasSize(2).last()
                .satisfies(notice -> assertThat(ru(notice).body())
                        .isEqualTo("Группа «ОГЭ». Было: четверг, 01.10 в 18:00."));
        assertThat(notices(events, anna)).as("the student who asked learns from the answer").hasSize(1);

        publish(new LessonStartingSoon(UUID.randomUUID(), group, List.of(boris), START, 90, null, null, null,
                Duration.ofHours(1), true, Instant.now()));
        assertThat(teacherNotices(events, "Скоро урок: группа «ОГЭ», четверг, 01.10 в 18:00")).hasSize(1);
        assertThat(ru(notices(events, boris).getLast()).body()).isEqualTo("Через 1 час. Группа «ОГЭ».");
    }

    @Test
    void absencesFromGroupLessons(AssertablePublishedEvents events) {
        UUID vera = directory.addStudent("Вера");
        UUID group = groups.addGroup("Английский", vera);

        publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), vera, group,
                ChangeKind.CANCEL, START, null, "Уезжаю", false, true, Instant.now()));
        assertThat(teacherNotices(events, "Вера не придёт на занятие группы")).singleElement()
                .satisfies(notice -> assertThat(ru(notice).body())
                        .isEqualTo("Занятие: четверг, 01.10 в 18:00, группа «Английский». Комментарий: Уезжаю"));

        UUID gleb = directory.addStudent("Глеб");
        publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), gleb, group,
                ChangeKind.CANCEL, START, null, null, true, false, Instant.now()));
        assertThat(teacherNotices(events, "Глеб не придёт на занятие группы")).singleElement()
                .satisfies(notice -> assertThat(ru(notice).body()).isEqualTo(
                        "Занятие: четверг, 01.10 в 18:00, группа «Английский». Поздно — решите, засчитать ли пропуск."));

        assertThat(ru(latest(events, gleb, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(), gleb, group,
                ChangeKind.CANCEL, true, START, true, null, Instant.now()))).title())
                .isEqualTo("Учитель знает, что вас не будет четверг, 01.10 в 18:00");
        UUID dina = directory.addStudent("Дина");
        assertThat(ru(latest(events, dina, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(), dina, group,
                ChangeKind.CANCEL, false, START, false, null, Instant.now()))).title())
                .isEqualTo("Пропуск занятия не согласован");
    }

    @Test
    void lostCalendarAccessIsReportedToTheTeacher(AssertablePublishedEvents events) {
        publish(new GoogleCalendarDisconnected("invalid_grant", Instant.now()));
        assertThat(teacherNotices(events, "Google Календарь отключён")).singleElement().satisfies(notice -> {
            assertThat(notice.kind()).isEqualTo("SCHEDULE_CALENDAR");
            assertThat(notice.link()).isEqualTo("/teacher/settings?open=calendar");
        });
    }

    @Test
    void aSharedSummaryReachesTheParticipants(AssertablePublishedEvents events) {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID lesson = UUID.randomUUID();
        NoticeRequested shared = latest(events, anna,
                new LessonSummaryShared(lesson, List.of(anna), directory.teacherId(), START, Instant.now()));
        assertThat(shared.kind()).isEqualTo("LESSON_SUMMARY");
        assertThat(ru(shared).title()).isEqualTo("Итоги урока 01.10");
        assertThat(shared.link()).isEqualTo("/cabinet/schedule?lesson=" + lesson);
        assertThat(ru(shared).body()).doesNotContain("Past");
        assertThat(notices(events, boris)).isEmpty();
    }

    @Test
    void theTeacherGetsButtonsUnderARequest(AssertablePublishedEvents events) {
        UUID asks = directory.addStudent("Кнопки");
        UUID requestId = UUID.randomUUID();
        publish(new LessonChangeRequested(requestId, UUID.randomUUID(), asks, null, ChangeKind.RESCHEDULE,
                START, LATER, null, false, false, Instant.now()));
        assertThat(teacherNotices(events, "Кнопки просит перенести занятие")).singleElement()
                .satisfies(notice -> assertThat(notice.subject())
                        .isEqualTo(new ChatSubject(LessonChangeRequested.CHAT_SUBJECT, requestId)));

        UUID absent = directory.addStudent("Без кнопок");
        UUID group = groups.addGroup("Кнопочная", absent);
        publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), absent, group,
                ChangeKind.CANCEL, START, null, null, false, true, Instant.now()));
        assertThat(teacherNotices(events, "Без кнопок не придёт на занятие группы")).singleElement()
                .satisfies(notice -> assertThat(notice.subject()).as("accepted at once: nothing to answer").isNull());
    }

    /** A notice is published by the request that changes the schedule, in its transaction. */
    @Test
    void planningALessonNotifiesTheStudent(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Запланирован");

        assertThat(mvc.post().uri("/api/teacher/schedule/lessons")
                .with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"%s\",\"startsAt\":\"%s\",\"durationMinutes\":60,\"allowOverlap\":true}"
                        .formatted(student, Slots.next(clock)))
                .exchange()).hasStatus2xxSuccessful();

        assertThat(notices(events, student)).singleElement().satisfies(notice -> {
            assertThat(notice.kind()).isEqualTo("SCHEDULE_LESSON_PLANNED");
            assertThat(ru(notice).title()).startsWith("Новое занятие: ");
            assertThat(en(notice).title()).startsWith("New lesson: ");
            assertThat(notice.link()).isEqualTo("/cabinet/schedule");
        });
    }

    /** A change that is rolled back publishes its notice into the same transaction: nothing is delivered. */
    @Test
    void aNoticeIsWrittenInsideTheTransactionOfTheEvent(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("В транзакции");
        transactions.executeWithoutResult(status -> {
            publisher.publishEvent(new LessonScheduled(UUID.randomUUID(), null, List.of(student), START, 60, null,
                    null, Instant.now()));
            assertThat(notices(events, student)).as("written before the commit, with the event").hasSize(1);
            status.setRollbackOnly();
        });
    }

    private NoticeRequested latest(AssertablePublishedEvents events, UUID recipient, Object event) {
        int before = notices(events, recipient).size();
        publish(event);
        List<NoticeRequested> written = notices(events, recipient);
        assertThat(written).hasSize(before + 1);
        return written.getLast();
    }

    /** As the application services do: an event is published inside a transaction. */
    private void publish(Object event) {
        transactions.executeWithoutResult(status -> publisher.publishEvent(event));
    }

    private static List<NoticeRequested> notices(AssertablePublishedEvents events, UUID recipient) {
        return StreamSupport.stream(events.ofType(NoticeRequested.class)
                .matching(notice -> notice.recipientId().equals(recipient)).spliterator(), false).toList();
    }

    private List<NoticeRequested> teacherNotices(AssertablePublishedEvents events, String title) {
        return notices(events, directory.teacherId()).stream()
                .filter(notice -> ru(notice).title().equals(title))
                .toList();
    }

    private static NoticeText ru(NoticeRequested notice) {
        return notice.text(Language.RU);
    }

    private static NoticeText en(NoticeRequested notice) {
        return notice.text(Language.EN);
    }
}
