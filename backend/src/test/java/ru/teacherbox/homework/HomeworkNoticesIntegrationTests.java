package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReminderRequested;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;

/** Homework events become notices in the transaction of the event (ADR-0061); Moscow time. */
@HomeworkIntegrationTest
class HomeworkNoticesIntegrationTests {

    /** 25.09.2026 18:30 in Moscow. */
    private static final Instant DUE = Instant.parse("2026-09-25T15:30:00Z");

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ApplicationEventPublisher publisher;

    @Autowired
    TransactionTemplate transactions;

    @Test
    void homeworkAssignedWithDeadline(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Мария");
        UUID task = UUID.randomUUID();

        NoticeRequested notice = single(events, student,
                new HomeworkAssigned(task, UUID.randomUUID(), student, "Дроби", DUE, Instant.now()));

        assertThat(notice.kind()).isEqualTo("HOMEWORK_ASSIGNED");
        assertThat(ru(notice).title()).isEqualTo("Новое задание: «Дроби»");
        assertThat(ru(notice).body()).isEqualTo("Срок сдачи: 25.09.2026 18:30");
        assertThat(notice.link()).isEqualTo("/cabinet/homework/" + task);
        assertThat(notice.subject()).isNull();
        assertThat(notice.joinUrl()).isNull();
    }

    @Test
    void homeworkAssignedWithoutDeadline(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Пётр");

        NoticeRequested notice = single(events, student,
                new HomeworkAssigned(UUID.randomUUID(), UUID.randomUUID(), student, "Эссе", null, Instant.now()));

        assertThat(ru(notice).body()).isNull();
        assertThat(en(notice).body()).isNull();
    }

    @Test
    void homeworkDueSoon(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Анна");

        NoticeRequested notice = single(events, student,
                new HomeworkDueSoon(UUID.randomUUID(), UUID.randomUUID(), student, "Дроби", DUE, Instant.now()));

        assertThat(notice.kind()).isEqualTo("HOMEWORK_DUE_SOON");
        assertThat(ru(notice).title()).isEqualTo("Скоро срок сдачи: «Дроби»");
        assertThat(ru(notice).body()).isEqualTo("Срок сдачи: 25.09.2026 18:30");
    }

    @Test
    void homeworkReminderFromTheTeacher(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Анна");

        NoticeRequested notice = single(events, student,
                new HomeworkReminderRequested(UUID.randomUUID(), UUID.randomUUID(), student, "Дроби", DUE,
                        Instant.now()));

        assertThat(notice.kind()).isEqualTo("HOMEWORK_REMINDER");
        assertThat(ru(notice).title()).isEqualTo("Учитель напоминает о задании «Дроби»");
        assertThat(ru(notice).body()).isEqualTo("Срок сдачи: 25.09.2026 18:30");
    }

    @Test
    void homeworkAcceptedAndReturned(AssertablePublishedEvents events) {
        UUID accepted = directory.addStudent("Отличник");
        UUID returned = directory.addStudent("Хорошист");
        UUID acceptedWithoutGrade = directory.addStudent("Без оценки");

        NoticeRequested ok = single(events, accepted,
                new HomeworkReviewed(UUID.randomUUID(), UUID.randomUUID(), accepted, "Дроби", true, "5", Instant.now()));
        NoticeRequested again = single(events, returned,
                new HomeworkReviewed(UUID.randomUUID(), UUID.randomUUID(), returned, "Дроби", false, null, Instant.now()));
        NoticeRequested noGrade = single(events, acceptedWithoutGrade, new HomeworkReviewed(UUID.randomUUID(),
                UUID.randomUUID(), acceptedWithoutGrade, "Дроби", true, null, Instant.now()));

        assertThat(ok.kind()).isEqualTo("HOMEWORK_REVIEWED");
        assertThat(ru(ok).title()).isEqualTo("Задание «Дроби» принято");
        assertThat(ru(ok).body()).isEqualTo("Оценка: 5");
        assertThat(ru(again).title()).isEqualTo("Задание «Дроби» возвращено на доработку");
        assertThat(ru(again).body()).isEqualTo("Посмотрите комментарий учителя.");
        assertThat(ru(noGrade).body()).isNull();
    }

    @Test
    void submissionNotifiesTheTeacher(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Мария Иванова");
        UUID task = UUID.randomUUID();

        publish(new HomeworkSubmitted(task, UUID.randomUUID(), student, "Дроби", Instant.now()));

        assertThat(notices(events, directory.teacherId())).singleElement().satisfies(notice -> {
            assertThat(notice.kind()).isEqualTo("HOMEWORK_SUBMITTED");
            assertThat(ru(notice).title()).isEqualTo("Работа на проверку: «Дроби»");
            assertThat(ru(notice).body()).isEqualTo("Ученик: Мария Иванова");
            assertThat(notice.link()).isEqualTo("/teacher/homework/tasks/" + task);
        });
    }

    @Test
    void submissionOfUnknownStudentStillNotifiesTheTeacher(AssertablePublishedEvents events) {
        publish(new HomeworkSubmitted(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "Дроби",
                Instant.now()));

        assertThat(notices(events, directory.teacherId())).singleElement().satisfies(notice -> {
            assertThat(ru(notice).body()).isEqualTo("Ученик: Ученик");
            assertThat(en(notice).body()).isEqualTo("Student: A student");
        });
    }

    @Test
    void everyNoticeIsWrittenInEnglishToo(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Mary");

        NoticeRequested assigned = single(events, student,
                new HomeworkAssigned(UUID.randomUUID(), UUID.randomUUID(), student, "Fractions", DUE, Instant.now()));

        assertThat(en(assigned).title()).isEqualTo("New assignment: “Fractions”");
        assertThat(en(assigned).body()).isEqualTo("Due: 25.09.2026 18:30");
    }

    private NoticeRequested single(AssertablePublishedEvents events, UUID recipient, Object event) {
        publish(event);
        List<NoticeRequested> written = notices(events, recipient);
        assertThat(written).hasSize(1);
        return written.getFirst();
    }

    /** As the application services do: an event is published inside a transaction. */
    private void publish(Object event) {
        transactions.executeWithoutResult(status -> publisher.publishEvent(event));
    }

    private static List<NoticeRequested> notices(AssertablePublishedEvents events, UUID recipient) {
        return StreamSupport.stream(events.ofType(NoticeRequested.class)
                .matching(notice -> notice.recipientId().equals(recipient)).spliterator(), false).toList();
    }

    private static NoticeText ru(NoticeRequested notice) {
        return notice.text(Language.RU);
    }

    private static NoticeText en(NoticeRequested notice) {
        return notice.text(Language.EN);
    }
}
