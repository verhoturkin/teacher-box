package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.shared.Ids;

/** How a child's notice reads for a guardian (ADR-0069). */
class NotificationServiceTest {

    private static final UUID CHILD = UUID.fromString("00000000-0000-7000-8000-000000000001");

    @Test
    void theStudentsPagesBecomeTheChildsPagesInTheFamilyCabinet() {
        String family = "/family/" + CHILD;
        assertThat(NotificationService.familyLink(CHILD, "/cabinet/schedule")).isEqualTo(family + "/schedule");
        assertThat(NotificationService.familyLink(CHILD, "/cabinet/schedule?lesson=5"))
                .isEqualTo(family + "/schedule?lesson=5");
        assertThat(NotificationService.familyLink(CHILD, "/cabinet/homework/42")).isEqualTo(family + "/homework/42");
        assertThat(NotificationService.familyLink(CHILD, "/cabinet/billing")).isEqualTo(family + "/billing");
        assertThat(NotificationService.familyLink(CHILD, "/cabinet/billingx")).isEqualTo(family);
        assertThat(NotificationService.familyLink(CHILD, "/cabinet/account")).isEqualTo(family);
        assertThat(NotificationService.familyLink(CHILD, "/teacher/schedule")).isEqualTo(family);
        assertThat(NotificationService.familyLink(CHILD, null)).isNull();
    }

    @Test
    void theTitleNamesTheChildAndStaysWithinTheLimit() {
        assertThat(NotificationService.childTitle(" Петя ", "Занятие перенесено"))
                .isEqualTo("Петя · Занятие перенесено");
        String longTitle = "Ж".repeat(InboxNotification.MAX_TITLE);
        assertThat(NotificationService.childTitle("Петя", longTitle)).hasSize(InboxNotification.MAX_TITLE)
                .startsWith("Петя · ").endsWith("…");
    }

    @Test
    void theChildIsNamedByTheFirstWordOfTheDisplayName() {
        assertThat(NotificationService.firstName(" Петя Смирнов ")).isEqualTo("Петя");
        assertThat(NotificationService.firstName("Соня")).isEqualTo("Соня");
    }

    @Test
    void eachGuardianHasOneCopyOfANotice() {
        UUID notice = Ids.newId();
        UUID guardian = Ids.newId();
        assertThat(NotificationService.guardianNoticeId(notice, guardian))
                .isEqualTo(NotificationService.guardianNoticeId(notice, guardian))
                .isNotEqualTo(NotificationService.guardianNoticeId(notice, Ids.newId()))
                .isNotEqualTo(notice);
    }
}
