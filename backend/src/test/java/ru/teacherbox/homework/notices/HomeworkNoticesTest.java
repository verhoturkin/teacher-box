package ru.teacherbox.homework.notices;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.testing.FakeUserDirectory;

class HomeworkNoticesTest {

    @Test
    void formatsTheDeadlineInInstanceTimeZone() {
        List<Object> published = new ArrayList<>();
        HomeworkNotices notices = new HomeworkNotices(published::add, new FakeUserDirectory(),
                new InstanceTimeZone(ZoneId.of("Asia/Yekaterinburg")));

        notices.on(new HomeworkDueSoon(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "Дроби",
                Instant.parse("2026-09-25T20:15:00Z"), Instant.now()));

        assertThat(published).singleElement().isInstanceOfSatisfying(NoticeRequested.class,
                notice -> assertThat(notice.text(Language.RU).body()).isEqualTo("Срок сдачи: 26.09.2026 01:15"));
    }
}
