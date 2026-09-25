package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Currency;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.modulith.test.Scenario;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.testing.FakeUserDirectory;

/** Events of other modules become notifications with Russian texts. */
@NotificationsIntegrationTest
class EventNotificationsIntegrationTests {

    private static final Currency RUB = Currency.getInstance("RUB");
    /** 25.09.2026 18:30 in Moscow. */
    private static final Instant DUE = Instant.parse("2026-09-25T15:30:00Z");

    @Autowired
    InboxRepository inbox;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void homeworkAssignedWithDeadline(Scenario scenario) {
        UUID student = directory.addStudent("Мария");
        UUID task = UUID.randomUUID();

        InboxNotification notification = single(scenario, student,
                new HomeworkAssigned(task, UUID.randomUUID(), student, "Дроби", DUE, Instant.now()));

        assertThat(notification.kind()).isEqualTo(NotificationKind.HOMEWORK_ASSIGNED);
        assertThat(notification.title()).isEqualTo("Новое задание: «Дроби»");
        assertThat(notification.body()).isEqualTo("Срок сдачи: 25.09.2026 18:30");
        assertThat(notification.link()).isEqualTo("/cabinet/homework/" + task);
        assertThat(notification.isRead()).isFalse();
    }

    @Test
    void homeworkAssignedWithoutDeadline(Scenario scenario) {
        UUID student = directory.addStudent("Пётр");

        InboxNotification notification = single(scenario, student,
                new HomeworkAssigned(UUID.randomUUID(), UUID.randomUUID(), student, "Эссе", null, Instant.now()));

        assertThat(notification.body()).isNull();
    }

    @Test
    void homeworkDueSoon(Scenario scenario) {
        UUID student = directory.addStudent("Анна");

        InboxNotification notification = single(scenario, student,
                new HomeworkDueSoon(UUID.randomUUID(), UUID.randomUUID(), student, "Дроби", DUE, Instant.now()));

        assertThat(notification.kind()).isEqualTo(NotificationKind.HOMEWORK_DUE_SOON);
        assertThat(notification.title()).isEqualTo("Скоро срок сдачи: «Дроби»");
        assertThat(notification.body()).isEqualTo("Срок сдачи: 25.09.2026 18:30");
    }

    @Test
    void homeworkAcceptedAndReturned(Scenario scenario) {
        UUID accepted = directory.addStudent("Отличник");
        UUID returned = directory.addStudent("Хорошист");
        UUID acceptedWithoutGrade = directory.addStudent("Без оценки");

        InboxNotification ok = single(scenario, accepted,
                new HomeworkReviewed(UUID.randomUUID(), UUID.randomUUID(), accepted, "Дроби", true, "5", Instant.now()));
        InboxNotification again = single(scenario, returned,
                new HomeworkReviewed(UUID.randomUUID(), UUID.randomUUID(), returned, "Дроби", false, null, Instant.now()));
        InboxNotification noGrade = single(scenario, acceptedWithoutGrade, new HomeworkReviewed(UUID.randomUUID(),
                UUID.randomUUID(), acceptedWithoutGrade, "Дроби", true, null, Instant.now()));

        assertThat(ok.title()).isEqualTo("Задание «Дроби» принято");
        assertThat(ok.body()).isEqualTo("Оценка: 5");
        assertThat(again.title()).isEqualTo("Задание «Дроби» возвращено на доработку");
        assertThat(again.body()).isEqualTo("Посмотрите комментарий учителя.");
        assertThat(noGrade.body()).isNull();
    }

    @Test
    void submissionNotifiesTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Мария Иванова");
        UUID task = UUID.randomUUID();

        scenario.publish(new HomeworkSubmitted(task, UUID.randomUUID(), student, "Дроби", Instant.now()))
                .andWaitForStateChange(() -> newest(directory.teacherId(), NotificationKind.HOMEWORK_SUBMITTED, task),
                        list -> !list.isEmpty())
                .andVerify(notifications -> {
                    InboxNotification notification = notifications.getFirst();
                    assertThat(notification.title()).isEqualTo("Работа на проверку: «Дроби»");
                    assertThat(notification.body()).isEqualTo("Ученик: Мария Иванова");
                });
    }

    @Test
    void submissionOfUnknownStudentStillNotifiesTheTeacher(Scenario scenario) {
        UUID task = UUID.randomUUID();

        scenario.publish(new HomeworkSubmitted(task, UUID.randomUUID(), UUID.randomUUID(), "Дроби", Instant.now()))
                .andWaitForStateChange(() -> newest(directory.teacherId(), NotificationKind.HOMEWORK_SUBMITTED, task),
                        list -> !list.isEmpty())
                .andVerify(notifications -> assertThat(notifications.getFirst().body()).isEqualTo("Ученик: Ученик"));
    }

    @Test
    void lessonsAndPayments(Scenario scenario) {
        UUID student = directory.addStudent("Плательщик");
        LocalDate date = LocalDate.of(2026, 9, 24);

        InboxNotification lesson = single(scenario, student, new LessonRecorded(UUID.randomUUID(), student, date, 60,
                rub(150_000), false, rub(-150_000), Instant.now()));
        assertThat(lesson.kind()).isEqualTo(NotificationKind.LESSON_RECORDED);
        assertThat(lesson.title()).isEqualTo("Занятие 24.09.2026");
        assertThat(lesson.body()).isEqualTo("Стоимость: 1 500 ₽. Задолженность: 1 500 ₽");
        assertThat(lesson.link()).isEqualTo("/cabinet/billing");

        UUID missedStudent = directory.addStudent("Прогульщик");
        InboxNotification missed = single(scenario, missedStudent, new LessonRecorded(UUID.randomUUID(),
                missedStudent, date, 60, rub(150_050), true, rub(0), Instant.now()));
        assertThat(missed.title()).isEqualTo("Пропуск занятия 24.09.2026");
        assertThat(missed.body()).isEqualTo("Стоимость: 1 500,50 ₽. Баланс: 0 ₽");

        UUID payer = directory.addStudent("Оплатил");
        InboxNotification payment = single(scenario, payer,
                new PaymentRecorded(UUID.randomUUID(), payer, rub(300_000), date, rub(150_000), Instant.now()));
        assertThat(payment.title()).isEqualTo("Получена оплата 3 000 ₽");
        assertThat(payment.body()).isEqualTo("Баланс: 1 500 ₽");

        UUID voided = directory.addStudent("Ошибка");
        InboxNotification voidedPayment = single(scenario, voided,
                new PaymentVoided(UUID.randomUUID(), voided, rub(300_000), rub(-10_000), Instant.now()));
        assertThat(voidedPayment.title()).isEqualTo("Оплата 3 000 ₽ аннулирована");
        assertThat(voidedPayment.body()).isEqualTo("Задолженность: 100 ₽");

        UUID cancelled = directory.addStudent("Отмена");
        InboxNotification cancelledLesson = single(scenario, cancelled,
                new LessonCancelled(UUID.randomUUID(), cancelled, date, rub(0), Instant.now()));
        assertThat(cancelledLesson.title()).isEqualTo("Занятие 24.09.2026 отменено");
        assertThat(cancelledLesson.body()).isEqualTo("Оплата за него не списывается. Баланс: 0 ₽");
    }

    @Test
    void activatedStudentNotifiesTheTeacher(Scenario scenario) {
        UUID student = directory.addStudent("Новенькая");

        scenario.publish(new StudentActivated(student, "Новенькая", Instant.now()))
                .andWaitForStateChange(() -> inbox.findPage(directory.teacherId(), 0, 100).stream()
                        .filter(n -> n.kind() == NotificationKind.STUDENT_ACTIVATED)
                        .filter(n -> n.body() != null && n.body().startsWith("Новенькая"))
                        .toList(), list -> !list.isEmpty())
                .andVerify(notifications -> {
                    assertThat(notifications.getFirst().title()).isEqualTo("Ученик присоединился к порталу");
                    assertThat(notifications.getFirst().link()).isEqualTo("/teacher/students");
                });
    }

    private InboxNotification single(Scenario scenario, UUID recipient, Object event) {
        AtomicReference<List<InboxNotification>> received = new AtomicReference<>();
        scenario.publish(event)
                .andWaitForStateChange(() -> inbox.findPage(recipient, 0, 10), list -> !list.isEmpty())
                .andVerify(received::set);
        assertThat(received.get()).hasSize(1);
        return received.get().getFirst();
    }

    private List<InboxNotification> newest(UUID recipient, NotificationKind kind, UUID task) {
        return inbox.findPage(recipient, 0, 100).stream()
                .filter(n -> n.kind() == kind && String.valueOf(n.link()).endsWith(task.toString()))
                .toList();
    }

    private static Money rub(long kopecks) {
        return Money.of(kopecks, RUB);
    }
}
