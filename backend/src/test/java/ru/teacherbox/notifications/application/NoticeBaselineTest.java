package ru.teacherbox.notifications.application;

import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.testing.notices.NoticeGolden;
import ru.teacherbox.testing.notices.NoticeGolden.Line;
import ru.teacherbox.testing.notices.NoticeGolden.Sample;
import ru.teacherbox.testing.notices.NoticeSamples;
import ru.teacherbox.testing.notices.SamplePeople;

/**
 * What the listeners of {@code notifications} write for the samples of each module — the golden
 * files the modules are compared with once they write their notices themselves (stage 380).
 */
class NoticeBaselineTest {

    private final SamplePeople people = new SamplePeople();
    private final NotificationTexts texts = new NotificationTexts(new InstanceTimeZone(NoticeSamples.ZONE));
    private final List<Line> notified = new ArrayList<>();
    /** Records every {@code notify(...)}: the recipient, the kind, the title, the text, the link, the subject, the room. */
    private final NotificationService notifications = mock(NotificationService.class, call -> {
        Object[] given = call.getArguments();
        JoinLink join = given.length > 6 ? (JoinLink) given[6] : null;
        notified.add(new Line((UUID) given[0], ((NotificationKind) given[1]).name(), (String) given[2],
                (String) given[3], (String) given[4], given.length > 5 ? (ChatSubject) given[5] : null,
                join == null ? null : join.url(), join == null ? null : join.body()));
        return null;
    });

    @Test
    void schedule() {
        compare("schedule", NoticeSamples.schedule(),
                new ScheduleNotifications(notifications, texts, people, people));
    }

    @Test
    void homework() {
        compare("homework", NoticeSamples.homework(), new HomeworkNotifications(notifications, texts, people));
    }

    @Test
    void billing() {
        compare("billing", NoticeSamples.billing(), new BillingNotifications(notifications, texts, people));
    }

    @Test
    void meetings() {
        compare("meetings", NoticeSamples.meetings(), new MeetingNotifications(notifications, people, people));
    }

    @Test
    void identity() {
        compare("identity", NoticeSamples.identity(), new StudentNotifications(notifications, people));
    }

    private void compare(String module, List<Sample> samples, Object listener) {
        NoticeGolden golden = new NoticeGolden();
        for (Language language : Language.values()) {
            people.read(language);
            for (Sample sample : samples) {
                notified.clear();
                NoticeGolden.deliver(listener, sample.event());
                golden.add(language, sample, List.copyOf(notified));
            }
        }
        golden.assertMatches(module);
    }
}
