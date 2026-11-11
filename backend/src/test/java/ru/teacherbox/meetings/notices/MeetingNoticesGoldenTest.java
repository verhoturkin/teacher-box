package ru.teacherbox.meetings.notices;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.testing.notices.NoticeGolden;
import ru.teacherbox.testing.notices.NoticeGolden.Line;
import ru.teacherbox.testing.notices.NoticeGolden.Sample;
import ru.teacherbox.testing.notices.NoticeSamples;
import ru.teacherbox.testing.notices.SamplePeople;

/**
 * The module writes the notices {@code notifications} wrote for it before ADR-0061: the same
 * recipients, kinds, texts in both languages, links and rooms ({@code notices/meetings.txt}).
 */
class MeetingNoticesGoldenTest {

    private final SamplePeople people = new SamplePeople();
    private final List<NoticeRequested> published = new ArrayList<>();
    private final MeetingNotices notices = new MeetingNotices(event -> published.add((NoticeRequested) event), people);

    @Test
    void writesWhatNotificationsWrote() {
        NoticeGolden golden = new NoticeGolden();
        for (Language language : Language.values()) {
            // The text of a language does not depend on what the recipients read.
            people.read(language == Language.RU ? Language.EN : Language.RU);
            for (Sample sample : NoticeSamples.meetings()) {
                published.clear();
                NoticeGolden.deliver(notices, sample.event());
                golden.add(language, sample, published.stream().map(notice -> Line.of(notice, language)).toList());
            }
        }
        golden.assertMatches("meetings");
    }
}
