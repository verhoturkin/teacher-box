package ru.teacherbox.notifications.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** The kind → category map of the guardians' notices (ADR-0069) and their switches. */
class GuardianCategoryTest {

    @Test
    void theFourCategoriesHoldTheKindsAParentGets() {
        Map<GuardianCategory, Set<NotificationKind>> map = Arrays.stream(NotificationKind.values())
                .filter(kind -> GuardianCategory.of(kind).isPresent())
                .collect(Collectors.groupingBy(kind -> GuardianCategory.of(kind).orElseThrow(), Collectors.toSet()));

        assertThat(map).containsOnlyKeys(GuardianCategory.values());
        assertThat(map.get(GuardianCategory.PAYMENTS)).containsExactlyInAnyOrder(NotificationKind.LESSON_RECORDED,
                NotificationKind.LESSON_CANCELLED, NotificationKind.PAYMENT_RECORDED, NotificationKind.PAYMENT_VOIDED);
        assertThat(map.get(GuardianCategory.LESSONS)).containsExactlyInAnyOrder(NotificationKind.SCHEDULE_REMINDER,
                NotificationKind.SCHEDULE_LESSON_PLANNED, NotificationKind.SCHEDULE_LESSON_MOVED,
                NotificationKind.SCHEDULE_LESSON_CANCELLED, NotificationKind.SCHEDULE_REQUEST_ANSWERED);
        assertThat(map.get(GuardianCategory.HOMEWORK_DEADLINES))
                .containsExactlyInAnyOrder(NotificationKind.HOMEWORK_DUE_SOON, NotificationKind.HOMEWORK_REMINDER);
        assertThat(map.get(GuardianCategory.REVIEWED_WORK)).containsExactly(NotificationKind.HOMEWORK_REVIEWED);
        assertThat(GuardianCategory.of(NotificationKind.MESSAGE)).isEmpty();
        assertThat(GuardianCategory.of(NotificationKind.HOMEWORK_ASSIGNED)).isEmpty();
    }

    @Test
    void everyCategoryIsOnUntilSwitchedOff() {
        assertThat(Arrays.stream(GuardianCategory.values()).allMatch(GuardianPreferences.DEFAULT::receives)).isTrue();
        GuardianPreferences off = new GuardianPreferences(Set.of(GuardianCategory.PAYMENTS));
        assertThat(off.receives(GuardianCategory.PAYMENTS)).isFalse();
        assertThat(off.receives(GuardianCategory.LESSONS)).isTrue();
    }
}
