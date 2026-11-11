package ru.teacherbox.billing.notices;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.testing.notices.NoticeGolden;
import ru.teacherbox.testing.notices.NoticeGolden.Line;
import ru.teacherbox.testing.notices.NoticeGolden.Sample;
import ru.teacherbox.testing.notices.NoticeSamples;

/**
 * The module writes the notices {@code notifications} wrote for it before ADR-0061: the same
 * recipients, kinds, texts in both languages and links ({@code notices/billing.txt}).
 */
class BillingNoticesGoldenTest {

    private final List<NoticeRequested> published = new ArrayList<>();
    private final BillingNotices notices = new BillingNotices(event -> published.add((NoticeRequested) event));

    @Test
    void writesWhatNotificationsWrote() {
        NoticeGolden golden = new NoticeGolden();
        for (Language language : Language.values()) {
            for (Sample sample : NoticeSamples.billing()) {
                published.clear();
                NoticeGolden.deliver(notices, sample.event());
                golden.add(language, sample, published.stream().map(notice -> Line.of(notice, language)).toList());
            }
        }
        golden.assertMatches("billing");
    }
}
