package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.modulith.test.Scenario;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonDeleted;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonRestored;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;

/** Schedule events become notifications for the student and the teacher (Moscow time). */
@NotificationsIntegrationTest
class ScheduleNotificationsIntegrationTests {

    /** Thursday, 01.10.2026 18:00 in Moscow. */
    private static final Instant START = Instant.parse("2026-10-01T15:00:00Z");
    /** Friday, 02.10.2026 19:30 in Moscow. */
    private static final Instant LATER = Instant.parse("2026-10-02T16:30:00Z");
    /** A moment before both lessons: only upcoming lessons are announced. */
    private static final Instant EARLIER = Instant.parse("2026-09-30T09:00:00Z");

    @Autowired
    InboxRepository inbox;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    FakeMessengerChannel telegram;

    @Test
    void newLessonsAndSeries(Scenario scenario) {
        UUID student = directory.addStudent("Новичок");
        InboxNotification single = latest(scenario, student,
                new LessonScheduled(UUID.randomUUID(), null, List.of(student), START, 60, "Дроби", Instant.now()));
        assertThat(single.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_PLANNED);
        assertThat(single.title()).isEqualTo("Новое занятие: четверг, 01.10 в 18:00");
        assertThat(single.body()).isEqualTo("Тема: Дроби");
        assertThat(single.link()).isEqualTo("/cabinet/schedule");

        UUID regular = directory.addStudent("Регулярный");
        InboxNotification series = latest(scenario, regular, new SeriesScheduled(UUID.randomUUID(), null, List.of(regular),
                List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY), LocalTime.of(18, 0), 60, 2,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), Instant.now()));
        assertThat(series.title()).isEqualTo("Регулярные занятия по вторникам и четвергам в 18:00");
        assertThat(series.body()).isEqualTo("С 01.10.2026 по 31.12.2026, раз в 2 недели.");

        UUID weekly = directory.addStudent("Каждую неделю");
        assertThat(latest(scenario, weekly, new SeriesScheduled(UUID.randomUUID(), null, List.of(weekly), List.of(DayOfWeek.MONDAY),
                LocalTime.of(9, 0), 60, 1, LocalDate.of(2026, 10, 5), null, Instant.now())).body())
                .isEqualTo("С 05.10.2026.");
    }

    @Test
    void stoppedSeriesAreAnnouncedUnlessReplaced(Scenario scenario) {
        UUID student = directory.addStudent("Каникулы");
        scenario.publish(new SeriesStopped(UUID.randomUUID(), null, List.of(student), LocalDate.of(2026, 10, 5), true,
                Instant.now())).andWaitForEventOfType(SeriesStopped.class).toArrive();
        assertThat(inbox.findPage(student, 0, 10)).isEmpty();

        InboxNotification stopped = latest(scenario, student, new SeriesStopped(UUID.randomUUID(), null, List.of(student),
                LocalDate.of(2026, 10, 5), false, Instant.now()));
        assertThat(stopped.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_CANCELLED);
        assertThat(stopped.body()).isEqualTo("Занятия по расписанию с 05.10.2026 отменены.");
    }

    @Test
    void movesAndCancellationsByTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Перенос");
        InboxNotification moved = latest(scenario, student, new LessonRescheduled(UUID.randomUUID(), null, List.of(student), START,
                LATER, 60, null, Instant.now()));
        assertThat(moved.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_MOVED);
        assertThat(moved.title()).isEqualTo("Занятие перенесено на пятница, 02.10 в 19:30");
        assertThat(moved.body()).isEqualTo("Было: четверг, 01.10 в 18:00.");

        UUID cancelled = directory.addStudent("Отмена");
        InboxNotification byTeacher = latest(scenario, cancelled, new ScheduledLessonCancelled(UUID.randomUUID(),
                null, List.of(cancelled), START, CancelledBy.STUDENT, "Заболел", true, false, Instant.now()));
        assertThat(byTeacher.title()).isEqualTo("Занятие четверг, 01.10 в 18:00 отменено");
        assertThat(byTeacher.body()).isEqualTo("Причина: Заболел Занятие засчитано как пропуск.");

        UUID quiet = directory.addStudent("Без причины");
        assertThat(latest(scenario, quiet, new ScheduledLessonCancelled(UUID.randomUUID(), null, List.of(quiet), START,
                CancelledBy.TEACHER, null, false, false, Instant.now())).body()).isNull();
    }

    @Test
    void aDeletedLessonIsCancelledForTheStudentsAndARestoredOneIsBack(Scenario scenario) {
        UUID student = directory.addStudent("Удалено");
        InboxNotification deleted = latest(scenario, student,
                new LessonDeleted(UUID.randomUUID(), null, List.of(student), START, true, EARLIER));
        assertThat(deleted.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_CANCELLED);
        assertThat(deleted.title()).isEqualTo("Занятие четверг, 01.10 в 18:00 отменено");
        assertThat(deleted.body()).isNull();

        UUID back = directory.addStudent("Снова в расписании");
        InboxNotification restored = latest(scenario, back,
                new LessonRestored(UUID.randomUUID(), null, List.of(back), LATER, 60, EARLIER));
        assertThat(restored.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_PLANNED);
        assertThat(restored.title()).isEqualTo("Занятие пятница, 02.10 в 19:30 снова в расписании");
        assertThat(restored.body()).isEqualTo("Отмена занятия снята.");

        UUID quiet = directory.addStudent("Не узнает");
        scenario.publish(new LessonDeleted(UUID.randomUUID(), null, List.of(quiet), START, false, EARLIER))
                .andWaitForEventOfType(LessonDeleted.class).toArrive();
        scenario.publish(new LessonDeleted(UUID.randomUUID(), null, List.of(quiet), START, true, LATER))
                .andWaitForEventOfType(LessonDeleted.class).toArrive();
        scenario.publish(new LessonRestored(UUID.randomUUID(), null, List.of(quiet), START, 60, LATER))
                .andWaitForEventOfType(LessonRestored.class).toArrive();
        assertThat(inbox.findPage(quiet, 0, 10)).isEmpty();
    }

    @Test
    void changesByRequestAreAnnouncedOnceByTheAnswer(Scenario scenario) {
        UUID student = directory.addStudent("По просьбе");
        scenario.publish(new LessonRescheduled(UUID.randomUUID(), null, List.of(student), START, LATER, 60, student, Instant.now()))
                .andWaitForEventOfType(LessonRescheduled.class).toArrive();
        scenario.publish(new ScheduledLessonCancelled(UUID.randomUUID(), null, List.of(student), START, CancelledBy.STUDENT, null,
                false, true, Instant.now())).andWaitForEventOfType(ScheduledLessonCancelled.class).toArrive();
        assertThat(inbox.findPage(student, 0, 10)).isEmpty();

        InboxNotification approvedMove = latest(scenario, student, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), student, null, ChangeKind.RESCHEDULE, true, LATER, false, "Договорились",
                Instant.now()));
        assertThat(approvedMove.kind()).isEqualTo(NotificationKind.SCHEDULE_REQUEST_ANSWERED);
        assertThat(approvedMove.title()).isEqualTo("Перенос согласован: пятница, 02.10 в 19:30");
        assertThat(approvedMove.body()).isEqualTo("Комментарий учителя: Договорились");

        UUID late = directory.addStudent("Поздно");
        InboxNotification charged = latest(scenario, late, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), late, null, ChangeKind.CANCEL, true, START, true, null, Instant.now()));
        assertThat(charged.title()).isEqualTo("Отмена занятия четверг, 01.10 в 18:00 согласована");
        assertThat(charged.body()).isEqualTo("Отмена поздняя, занятие засчитано как пропуск.");

        UUID declinedMove = directory.addStudent("Отказ переноса");
        assertThat(latest(scenario, declinedMove, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(),
                declinedMove, null, ChangeKind.RESCHEDULE, false, START, false, null, Instant.now())).title())
                .isEqualTo("Перенос занятия не согласован");
        UUID declinedCancel = directory.addStudent("Отказ отмены");
        InboxNotification declined = latest(scenario, declinedCancel, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), declinedCancel, null, ChangeKind.CANCEL, false, START, false, null, Instant.now()));
        assertThat(declined.title()).isEqualTo("Отмена занятия не согласована");
        assertThat(declined.body()).isEqualTo("Занятие остаётся: четверг, 01.10 в 18:00.");
    }

    @Test
    void requestsGoToTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Просит");
        UUID lesson = UUID.randomUUID();

        scenario.publish(new LessonChangeRequested(UUID.randomUUID(), lesson, student, null, ChangeKind.RESCHEDULE, START,
                        LATER, "Можно позже?", false, false, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Просит просит перенести занятие"),
                        list -> !list.isEmpty())
                .andVerify(list -> {
                    assertThat(list.getFirst().kind()).isEqualTo(NotificationKind.SCHEDULE_REQUEST);
                    assertThat(list.getFirst().body()).isEqualTo("Занятие: четверг, 01.10 в 18:00. "
                            + "Предлагает: пятница, 02.10 в 19:30. Комментарий: Можно позже?");
                    assertThat(list.getFirst().link()).isEqualTo("/teacher/schedule");
                });

        UUID late = directory.addStudent("Отменяет поздно");
        scenario.publish(new LessonChangeRequested(UUID.randomUUID(), lesson, late, null, ChangeKind.CANCEL, START, null,
                        null, true, false, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Отменяет поздно просит отменить занятие"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("Занятие: четверг, 01.10 в 18:00. Поздняя отмена."));
    }

    @Test
    void remindersGoToTheStudentAndTheLastOneToTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Напомнить");
        InboxNotification early = latest(scenario, student, new LessonStartingSoon(UUID.randomUUID(), null, List.of(student), START,
                60, null, null, Duration.ofHours(24), false, Instant.now()));
        assertThat(early.kind()).isEqualTo(NotificationKind.SCHEDULE_REMINDER);
        assertThat(early.title()).isEqualTo("Скоро занятие: четверг, 01.10 в 18:00");
        assertThat(early.body()).isEqualTo("Через 24 часа.");
        assertThat(teacherNotifications("Скоро урок: Напомнить, четверг, 01.10 в 18:00")).isEmpty();

        UUID last = directory.addStudent("Последнее");
        scenario.publish(new LessonStartingSoon(UUID.randomUUID(), null, List.of(last), START, 60, "Дроби",
                        "https://zoom.us/j/1", Duration.ofHours(1), true, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Скоро урок: Последнее, четверг, 01.10 в 18:00"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("Через 1 час. Ссылка на урок: https://zoom.us/j/1"));
        assertThat(inbox.findPage(last, 0, 10).getFirst().body())
                .isEqualTo("Через 1 час. Тема: Дроби. Ссылка на урок: https://zoom.us/j/1");
    }

    @Test
    void groupLessonsReachEveryParticipant(Scenario scenario) {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);

        scenario.publish(new LessonScheduled(UUID.randomUUID(), group, List.of(anna, boris), START, 90, null,
                        Instant.now()))
                .andWaitForStateChange(() -> inbox.findPage(boris, 0, 10), list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body()).isEqualTo("Группа «ОГЭ»."));
        assertThat(inbox.findPage(anna, 0, 10)).hasSize(1);

        scenario.publish(new LessonRescheduled(UUID.randomUUID(), group, List.of(anna, boris), START, LATER, 90, anna,
                        Instant.now()))
                .andWaitForStateChange(() -> inbox.findPage(boris, 0, 10), list -> list.size() == 2)
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("Группа «ОГЭ». Было: четверг, 01.10 в 18:00."));
        assertThat(inbox.findPage(anna, 0, 10)).as("the student who asked learns from the answer").hasSize(1);

        scenario.publish(new LessonStartingSoon(UUID.randomUUID(), group, List.of(boris), START, 90, null, null,
                        Duration.ofHours(1), true, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Скоро урок: группа «ОГЭ», четверг, 01.10 в 18:00"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list).hasSize(1));
        assertThat(inbox.findPage(boris, 0, 10).getFirst().body()).isEqualTo("Через 1 час. Группа «ОГЭ».");
    }

    @Test
    void absencesFromGroupLessons(Scenario scenario) {
        UUID vera = directory.addStudent("Вера");
        UUID group = groups.addGroup("Английский", vera);

        scenario.publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), vera, group,
                        ChangeKind.CANCEL, START, null, "Уезжаю", false, true, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Вера не придёт на занятие группы"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("Занятие: четверг, 01.10 в 18:00, группа «Английский». Комментарий: Уезжаю"));

        UUID gleb = directory.addStudent("Глеб");
        scenario.publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), gleb, group,
                        ChangeKind.CANCEL, START, null, null, true, false, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Глеб не придёт на занятие группы"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body()).isEqualTo(
                        "Занятие: четверг, 01.10 в 18:00, группа «Английский». Поздно — решите, засчитать ли пропуск."));

        assertThat(latest(scenario, gleb, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(), gleb, group,
                ChangeKind.CANCEL, true, START, true, null, Instant.now())).title())
                .isEqualTo("Учитель знает, что вас не будет четверг, 01.10 в 18:00");
        UUID dina = directory.addStudent("Дина");
        assertThat(latest(scenario, dina, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(), dina, group,
                ChangeKind.CANCEL, false, START, false, null, Instant.now())).title())
                .isEqualTo("Пропуск занятия не согласован");
    }

    @Test
    void lostCalendarAccessIsReportedToTheTeacher(Scenario scenario) {
        scenario.publish(new GoogleCalendarDisconnected("invalid_grant", Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Google Календарь отключён"), list -> !list.isEmpty())
                .andVerify(list -> {
                    assertThat(list.getFirst().kind()).isEqualTo(NotificationKind.SCHEDULE_CALENDAR);
                    assertThat(list.getFirst().link()).isEqualTo("/teacher/settings");
                });
    }

    private InboxNotification latest(Scenario scenario, UUID recipient, Object event) {
        AtomicReference<List<InboxNotification>> received = new AtomicReference<>();
        scenario.publish(event)
                .andWaitForStateChange(() -> inbox.findPage(recipient, 0, 10), list -> !list.isEmpty())
                .andVerify(received::set);
        assertThat(received.get()).hasSize(1);
        return received.get().getFirst();
    }

    private List<InboxNotification> teacherNotifications(String title) {
        return inbox.findPage(directory.teacherId(), 0, 200).stream()
                .filter(notification -> notification.title().equals(title))
                .toList();
    }

    @Test
    void theTeacherGetsButtonsUnderARequest(Scenario scenario) {
        links.save(new ChannelLink(UUID.randomUUID(), directory.teacherId(), ChannelType.TELEGRAM, "8900", "@teacher",
                true, Instant.now()));
        try {
            UUID asks = directory.addStudent("Кнопки");
            UUID requestId = UUID.randomUUID();
            scenario.publish(new LessonChangeRequested(requestId, UUID.randomUUID(), asks, null, ChangeKind.RESCHEDULE,
                            START, LATER, null, false, false, Instant.now()))
                    .andWaitForStateChange(() -> teacherDeliveries("Кнопки просит перенести занятие"),
                            list -> !list.isEmpty())
                    .andVerify(list -> assertThat(list.getFirst().keyboard()).contains("Принять", "Отклонить"));

            UUID absent = directory.addStudent("Без кнопок");
            UUID group = groups.addGroup("Кнопочная", absent);
            scenario.publish(new LessonChangeRequested(UUID.randomUUID(), UUID.randomUUID(), absent, group,
                            ChangeKind.CANCEL, START, null, null, false, true, Instant.now()))
                    .andWaitForStateChange(() -> teacherDeliveries("Без кнопок не придёт на занятие группы"),
                            list -> !list.isEmpty())
                    .andVerify(list -> assertThat(list.getFirst().keyboard()).isNull());
        } finally {
            // Send what the link got, so that no delivery to it stays for the other tests.
            telegram.reset();
            dispatcher.dispatch();
            telegram.reset();
            links.delete(directory.teacherId(), ChannelType.TELEGRAM);
        }
    }

    private List<Delivery> teacherDeliveries(String text) {
        return deliveries.findByRecipient(directory.teacherId()).stream()
                .filter(delivery -> delivery.text().startsWith(text))
                .toList();
    }
}
