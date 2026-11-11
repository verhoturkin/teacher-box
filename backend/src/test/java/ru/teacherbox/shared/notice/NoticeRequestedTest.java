package ru.teacherbox.shared.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;

class NoticeRequestedTest {

    private enum Kind implements NoticeKind { SAMPLE }

    @Test
    void aNoticeIsWrittenInEveryLanguage() {
        UUID recipient = UUID.randomUUID();

        NoticeRequested notice = NoticeRequested.of(recipient, Kind.SAMPLE,
                language -> new NoticeText("title " + language, "body " + language), "/cabinet");

        assertThat(notice.id()).isNotNull();
        assertThat(notice.recipientId()).isEqualTo(recipient);
        assertThat(notice.kind()).isEqualTo("SAMPLE");
        assertThat(notice.link()).isEqualTo("/cabinet");
        assertThat(notice.subject()).isNull();
        assertThat(notice.joinUrl()).isNull();
        assertThat(notice.texts()).containsOnlyKeys(Language.values());
        for (Language language : Language.values()) {
            assertThat(notice.text(language)).isEqualTo(new NoticeText("title " + language, "body " + language, null));
        }
    }

    @Test
    void theSubjectAndTheRoomKeepTheNotice() {
        NoticeRequested notice = NoticeRequested.of(UUID.randomUUID(), Kind.SAMPLE,
                language -> new NoticeText("title", "body https://room.example", "body"), null);
        ChatSubject subject = new ChatSubject("sample", UUID.randomUUID());

        NoticeRequested full = notice.about(subject).withRoom("https://room.example");

        assertThat(full.subject()).isEqualTo(subject);
        assertThat(full.joinUrl()).isEqualTo("https://room.example");
        assertThat(full.about(null).withRoom(null)).isEqualTo(notice);
        assertThat(full.id()).isEqualTo(notice.id());
        assertThat(full.texts()).isEqualTo(notice.texts());
    }

    @Test
    void aNoticeWithoutALanguageIsRefused() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> new NoticeRequested(id, id, "SAMPLE",
                Map.of(Language.RU, new NoticeText("Заголовок", null)), null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("EN");
        assertThatThrownBy(() -> new NoticeText(null, null)).isInstanceOf(NullPointerException.class);
    }
}
