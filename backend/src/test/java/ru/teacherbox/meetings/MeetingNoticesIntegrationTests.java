package ru.teacherbox.meetings;

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
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.testing.FakeStudentGroups;

/** A room link sent by the teacher becomes a notice for every recipient (ADR-0061). */
@MeetingsIntegrationTest
class MeetingNoticesIntegrationTests {

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ApplicationEventPublisher publisher;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void theLinkOfAGroupRoomReachesTheMembers(AssertablePublishedEvents events) {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);

        publish(new MeetingLinkShared(group, group, List.of(anna, boris), "https://telemost.yandex.ru/j/5",
                Instant.now()));

        assertThat(notices(events, boris)).singleElement().satisfies(notice -> {
            assertThat(notice.kind()).isEqualTo("MEETING_LINK");
            assertThat(ru(notice).title()).isEqualTo("Ссылка на урок");
            assertThat(ru(notice).body())
                    .isEqualTo("По этой ссылке проходят уроки группы «ОГЭ»: https://telemost.yandex.ru/j/5");
            assertThat(en(notice).body()).isEqualTo("Join lessons for “ОГЭ” here: https://telemost.yandex.ru/j/5");
        });
        assertThat(notices(events, anna)).hasSize(1);
    }

    @Test
    void theLinkOfAStudentRoom(AssertablePublishedEvents events) {
        UUID vera = directory.addStudent("Вера");

        NoticeRequested notice = single(events, vera,
                new MeetingLinkShared(vera, null, List.of(vera), "https://zoom.us/j/1", Instant.now()));

        assertThat(ru(notice).body()).isEqualTo("По этой ссылке проходят наши уроки: https://zoom.us/j/1");
        assertThat(ru(notice).roomBody()).as("the address goes as a button in messengers")
                .isEqualTo("Здесь проходят наши уроки.");
        assertThat(notice.joinUrl()).isEqualTo("https://zoom.us/j/1");
        assertThat(notice.link()).isEqualTo("/cabinet/schedule");
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
