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
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.testing.FakeUserDirectory;

/** Schedule events become notifications for the student and the teacher (Moscow time). */
@NotificationsIntegrationTest
class ScheduleNotificationsIntegrationTests {

    /** Thursday, 01.10.2026 18:00 in Moscow. */
    private static final Instant START = Instant.parse("2026-10-01T15:00:00Z");
    /** Friday, 02.10.2026 19:30 in Moscow. */
    private static final Instant LATER = Instant.parse("2026-10-02T16:30:00Z");

    @Autowired
    InboxRepository inbox;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void newLessonsAndSeries(Scenario scenario) {
        UUID student = directory.addStudent("Новичок");
        InboxNotification single = latest(scenario, student,
                new LessonScheduled(UUID.randomUUID(), student, START, 60, "Дроби", Instant.now()));
        assertThat(single.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_PLANNED);
        assertThat(single.title()).isEqualTo("Новое занятие: четверг, 01.10 в 18:00");
        assertThat(single.body()).isEqualTo("Тема: Дроби");
        assertThat(single.link()).isEqualTo("/cabinet/schedule");

        UUID regular = directory.addStudent("Регулярный");
        InboxNotification series = latest(scenario, regular, new SeriesScheduled(UUID.randomUUID(), regular,
                List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY), LocalTime.of(18, 0), 60, 2,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), Instant.now()));
        assertThat(series.title()).isEqualTo("Регулярные занятия по вторникам и четвергам в 18:00");
        assertThat(series.body()).isEqualTo("С 01.10.2026 по 31.12.2026, раз в 2 недели.");

        UUID weekly = directory.addStudent("Каждую неделю");
        assertThat(latest(scenario, weekly, new SeriesScheduled(UUID.randomUUID(), weekly, List.of(DayOfWeek.MONDAY),
                LocalTime.of(9, 0), 60, 1, LocalDate.of(2026, 10, 5), null, Instant.now())).body())
                .isEqualTo("С 05.10.2026.");
    }

    @Test
    void stoppedSeriesAreAnnouncedUnlessReplaced(Scenario scenario) {
        UUID student = directory.addStudent("Каникулы");
        scenario.publish(new SeriesStopped(UUID.randomUUID(), student, LocalDate.of(2026, 10, 5), true,
                Instant.now())).andWaitForEventOfType(SeriesStopped.class).toArrive();
        assertThat(inbox.findPage(student, 0, 10)).isEmpty();

        InboxNotification stopped = latest(scenario, student, new SeriesStopped(UUID.randomUUID(), student,
                LocalDate.of(2026, 10, 5), false, Instant.now()));
        assertThat(stopped.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_CANCELLED);
        assertThat(stopped.body()).isEqualTo("Занятия по расписанию с 05.10.2026 отменены.");
    }

    @Test
    void movesAndCancellationsByTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Перенос");
        InboxNotification moved = latest(scenario, student, new LessonRescheduled(UUID.randomUUID(), student, START,
                LATER, 60, false, Instant.now()));
        assertThat(moved.kind()).isEqualTo(NotificationKind.SCHEDULE_LESSON_MOVED);
        assertThat(moved.title()).isEqualTo("Занятие перенесено на пятница, 02.10 в 19:30");
        assertThat(moved.body()).isEqualTo("Было: четверг, 01.10 в 18:00.");

        UUID cancelled = directory.addStudent("Отмена");
        InboxNotification byTeacher = latest(scenario, cancelled, new ScheduledLessonCancelled(UUID.randomUUID(),
                cancelled, START, CancelledBy.STUDENT, "Заболел", true, false, Instant.now()));
        assertThat(byTeacher.title()).isEqualTo("Занятие четверг, 01.10 в 18:00 отменено");
        assertThat(byTeacher.body()).isEqualTo("Причина: Заболел Занятие засчитано как пропуск.");

        UUID quiet = directory.addStudent("Без причины");
        assertThat(latest(scenario, quiet, new ScheduledLessonCancelled(UUID.randomUUID(), quiet, START,
                CancelledBy.TEACHER, null, false, false, Instant.now())).body()).isNull();
    }

    @Test
    void changesByRequestAreAnnouncedOnceByTheAnswer(Scenario scenario) {
        UUID student = directory.addStudent("По просьбе");
        scenario.publish(new LessonRescheduled(UUID.randomUUID(), student, START, LATER, 60, true, Instant.now()))
                .andWaitForEventOfType(LessonRescheduled.class).toArrive();
        scenario.publish(new ScheduledLessonCancelled(UUID.randomUUID(), student, START, CancelledBy.STUDENT, null,
                false, true, Instant.now())).andWaitForEventOfType(ScheduledLessonCancelled.class).toArrive();
        assertThat(inbox.findPage(student, 0, 10)).isEmpty();

        InboxNotification approvedMove = latest(scenario, student, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), student, ChangeKind.RESCHEDULE, true, LATER, false, "Договорились",
                Instant.now()));
        assertThat(approvedMove.kind()).isEqualTo(NotificationKind.SCHEDULE_REQUEST_ANSWERED);
        assertThat(approvedMove.title()).isEqualTo("Перенос согласован: пятница, 02.10 в 19:30");
        assertThat(approvedMove.body()).isEqualTo("Комментарий учителя: Договорились");

        UUID late = directory.addStudent("Поздно");
        InboxNotification charged = latest(scenario, late, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), late, ChangeKind.CANCEL, true, START, true, null, Instant.now()));
        assertThat(charged.title()).isEqualTo("Отмена занятия четверг, 01.10 в 18:00 согласована");
        assertThat(charged.body()).isEqualTo("Отмена поздняя, занятие засчитано как пропуск.");

        UUID declinedMove = directory.addStudent("Отказ переноса");
        assertThat(latest(scenario, declinedMove, new LessonChangeResolved(UUID.randomUUID(), UUID.randomUUID(),
                declinedMove, ChangeKind.RESCHEDULE, false, START, false, null, Instant.now())).title())
                .isEqualTo("Перенос занятия не согласован");
        UUID declinedCancel = directory.addStudent("Отказ отмены");
        InboxNotification declined = latest(scenario, declinedCancel, new LessonChangeResolved(UUID.randomUUID(),
                UUID.randomUUID(), declinedCancel, ChangeKind.CANCEL, false, START, false, null, Instant.now()));
        assertThat(declined.title()).isEqualTo("Отмена занятия не согласована");
        assertThat(declined.body()).isEqualTo("Занятие остаётся: четверг, 01.10 в 18:00.");
    }

    @Test
    void requestsGoToTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Просит");
        UUID lesson = UUID.randomUUID();

        scenario.publish(new LessonChangeRequested(UUID.randomUUID(), lesson, student, ChangeKind.RESCHEDULE, START,
                        LATER, "Можно позже?", false, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Просит просит перенести занятие"),
                        list -> !list.isEmpty())
                .andVerify(list -> {
                    assertThat(list.getFirst().kind()).isEqualTo(NotificationKind.SCHEDULE_REQUEST);
                    assertThat(list.getFirst().body()).isEqualTo("Занятие: четверг, 01.10 в 18:00. "
                            + "Предлагает: пятница, 02.10 в 19:30. Комментарий: Можно позже?");
                    assertThat(list.getFirst().link()).isEqualTo("/teacher/schedule");
                });

        UUID late = directory.addStudent("Отменяет поздно");
        scenario.publish(new LessonChangeRequested(UUID.randomUUID(), lesson, late, ChangeKind.CANCEL, START, null,
                        null, true, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Отменяет поздно просит отменить занятие"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("Занятие: четверг, 01.10 в 18:00. Поздняя отмена."));
    }

    @Test
    void remindersGoToTheStudentAndTheLastOneToTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Напомнить");
        InboxNotification early = latest(scenario, student, new LessonStartingSoon(UUID.randomUUID(), student, START,
                60, null, null, Duration.ofHours(24), false, Instant.now()));
        assertThat(early.kind()).isEqualTo(NotificationKind.SCHEDULE_REMINDER);
        assertThat(early.title()).isEqualTo("Скоро занятие: четверг, 01.10 в 18:00");
        assertThat(early.body()).isEqualTo("Через 24 часа.");
        assertThat(teacherNotifications("Скоро урок: Напомнить, четверг, 01.10 в 18:00")).isEmpty();

        UUID last = directory.addStudent("Последнее");
        scenario.publish(new LessonStartingSoon(UUID.randomUUID(), last, START, 60, "Дроби",
                        "https://zoom.us/j/1", Duration.ofHours(1), true, Instant.now()))
                .andWaitForStateChange(() -> teacherNotifications("Скоро урок: Последнее, четверг, 01.10 в 18:00"),
                        list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("Через 1 час. Ссылка на урок: https://zoom.us/j/1"));
        assertThat(inbox.findPage(last, 0, 10).getFirst().body())
                .isEqualTo("Через 1 час. Тема: Дроби. Ссылка на урок: https://zoom.us/j/1");
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
}
