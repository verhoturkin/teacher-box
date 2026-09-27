package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.modulith.test.Scenario;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;

/** A room link sent by the teacher reaches every recipient. */
@NotificationsIntegrationTest
class MeetingNotificationsIntegrationTests {

    @Autowired
    InboxRepository inbox;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void theLinkOfAGroupRoomReachesTheMembers(Scenario scenario) {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);

        scenario.publish(new MeetingLinkShared(group, group, List.of(anna, boris), "https://telemost.yandex.ru/j/5",
                        Instant.now()))
                .andWaitForStateChange(() -> inbox.findPage(boris, 0, 10), list -> !list.isEmpty())
                .andVerify(list -> {
                    assertThat(list.getFirst().kind()).isEqualTo(NotificationKind.MEETING_LINK);
                    assertThat(list.getFirst().title()).isEqualTo("Ссылка на урок");
                    assertThat(list.getFirst().body())
                            .isEqualTo("По этой ссылке проходят уроки группы «ОГЭ»: https://telemost.yandex.ru/j/5");
                });
        assertThat(inbox.findPage(anna, 0, 10)).hasSize(1);
    }

    @Test
    void theLinkOfAStudentRoom(Scenario scenario) {
        UUID vera = directory.addStudent("Вера");

        scenario.publish(new MeetingLinkShared(vera, null, List.of(vera), "https://zoom.us/j/1", Instant.now()))
                .andWaitForStateChange(() -> inbox.findPage(vera, 0, 10), list -> !list.isEmpty())
                .andVerify(list -> assertThat(list.getFirst().body())
                        .isEqualTo("По этой ссылке проходят наши уроки: https://zoom.us/j/1"));
    }
}
