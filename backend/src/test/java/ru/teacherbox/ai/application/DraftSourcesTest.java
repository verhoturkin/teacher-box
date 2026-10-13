package ru.teacherbox.ai.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.ByteArrayResource;
import ru.teacherbox.ai.application.DraftSources.AssignmentFileRef;
import ru.teacherbox.ai.application.DraftSources.Source;
import ru.teacherbox.ai.application.DraftSources.TextbookPages;
import ru.teacherbox.ai.application.DraftSources.Upload;
import ru.teacherbox.homework.api.AssignmentFiles;
import ru.teacherbox.homework.api.AssignmentFiles.AssignmentFile;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.TextbookSummary;
import ru.teacherbox.textbooks.api.Textbooks;

class DraftSourcesTest {

    private final Textbooks textbooks = mock(Textbooks.class);
    private final AssignmentFiles files = mock(AssignmentFiles.class);
    private final DraftSources sources = new DraftSources(textbooks, files);

    private UUID textbook(TextbookFormat format, Integer pageCount) {
        UUID id = UUID.randomUUID();
        when(textbooks.find(id)).thenReturn(Optional.of(
                new TextbookSummary(id, TextbookKind.TEXTBOOK, "Spotlight 5", null, format, pageCount)));
        return id;
    }

    private static TextbookContent content(String type, String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        return new TextbookContent("file", type, bytes.length, new ByteArrayResource(bytes));
    }

    @Test
    void readsTheChosenPagesOfATextbook() {
        UUID id = textbook(TextbookFormat.PDF, 120);
        when(textbooks.content(eq(id), any())).thenAnswer(call -> {
            PageRanges pages = call.getArgument(1);
            return content("application/pdf", "%PDF " + pages.text());
        });

        List<LlmSource> read = sources.read(List.of(new TextbookPages(id, " 12 – 14 ")));

        assertThat(read).singleElement().satisfies(source -> {
            assertThat(source.name()).isEqualTo("Spotlight 5, с. 12-14");
            assertThat(source.isPdf()).isTrue();
            assertThat(new String(source.content(), StandardCharsets.UTF_8)).isEqualTo("%PDF 12-14");
        });
    }

    @Test
    void aShortTextbookIsReadWholeAndAPictureAsItIs() {
        UUID shortOne = textbook(TextbookFormat.PDF, 3);
        UUID scan = textbook(TextbookFormat.IMAGE, 1);
        when(textbooks.content(eq(shortOne), any())).thenReturn(content("application/pdf", "%PDF"));
        when(textbooks.file(scan)).thenReturn(content("image/PNG", "png"));

        List<LlmSource> read = sources.read(List.of(new TextbookPages(shortOne, null), new TextbookPages(scan, "1")));

        assertThat(read).extracting(LlmSource::mediaType).containsExactly("application/pdf", "image/png");
        assertThat(read).extracting(LlmSource::name).containsExactly("Spotlight 5", "Spotlight 5");
    }

    @Test
    void readsAFileOfTheAssignment() {
        UUID assignment = UUID.randomUUID();
        UUID attachment = UUID.randomUUID();
        when(files.file(assignment, attachment)).thenReturn(new AssignmentFile("Задачи.jpg", "image/jpeg; q=1", 3,
                new ByteArrayResource(new byte[] {1, 2, 3})));

        assertThat(sources.read(List.of(new AssignmentFileRef(assignment, attachment)))).singleElement()
                .satisfies(source -> {
                    assertThat(source.name()).isEqualTo("Задачи.jpg");
                    assertThat(source.mediaType()).isEqualTo("image/jpeg");
                });
    }

    @Test
    void readsAFileSentWithTheRequest() {
        Upload scan = new Upload("Скан.png", "image/png", 3, new ByteArrayResource(new byte[] {1, 2, 3}));
        Upload text = new Upload("a.txt", "text/plain", 1, new ByteArrayResource(new byte[] {1}));

        assertThat(sources.read(List.of(scan))).singleElement().satisfies(source -> {
            assertThat(source.name()).isEqualTo("Скан.png");
            assertThat(source.mediaType()).isEqualTo("image/png");
            assertThat(source.content()).containsExactly(1, 2, 3);
        });
        assertThatThrownBy(() -> sources.read(List.of(text)))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.source-unsupported"));
    }

    @Test
    void refusesWhatTheModelCannotRead() {
        UUID word = textbook(TextbookFormat.DOCUMENT, 10);
        UUID assignment = UUID.randomUUID();
        UUID text = UUID.randomUUID();
        when(files.file(assignment, text)).thenReturn(new AssignmentFile("a.txt", "text/plain", 1,
                new ByteArrayResource(new byte[] {1})));

        assertThatThrownBy(() -> sources.read(List.of(new TextbookPages(word, null))))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.source-unsupported"));
        assertThatThrownBy(() -> sources.read(List.of(new AssignmentFileRef(assignment, text))))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.source-unsupported"));
    }

    @Test
    void refusesTooMuch() {
        UUID big = textbook(TextbookFormat.PDF, 120);
        UUID huge = textbook(TextbookFormat.IMAGE, 1);
        when(textbooks.file(huge)).thenReturn(new TextbookContent("big.png", "image/png",
                DraftSources.MAX_BYTES + 1, new ByteArrayResource(new byte[0])));
        UUID pdf = textbook(TextbookFormat.PDF, 3);
        when(textbooks.content(eq(pdf), any())).thenReturn(new TextbookContent("a.pdf", "application/pdf",
                DraftSources.MAX_BYTES - 1, new SizedResource(DraftSources.MAX_BYTES - 1)));
        Source onePage = new TextbookPages(pdf, "1");

        for (List<Source> request : List.of(
                List.<Source>of(new TextbookPages(big, null)),
                List.<Source>of(new TextbookPages(big, "1-21")),
                List.<Source>of(new TextbookPages(huge, null)),
                List.of(onePage, onePage),
                Collections.nCopies(DraftSources.MAX_SOURCES + 1, onePage))) {
            assertThatThrownBy(() -> sources.read(request))
                    .isInstanceOfSatisfying(BusinessRuleException.class,
                            e -> assertThat(e.code()).isEqualTo("ai.source-too-large"));
        }
    }

    @Test
    void aMissingSourceIsNotFound() {
        UUID assignment = UUID.randomUUID();
        UUID attachment = UUID.randomUUID();
        when(files.file(assignment, attachment)).thenThrow(new NotFoundException("file.not-found", "x"));

        assertThatThrownBy(() -> sources.read(List.of(new TextbookPages(UUID.randomUUID(), null))))
                .isInstanceOfSatisfying(NotFoundException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.source-not-found"));
        assertThatThrownBy(() -> sources.read(List.of(new AssignmentFileRef(assignment, attachment))))
                .isInstanceOfSatisfying(NotFoundException.class,
                        e -> assertThat(e.code()).isEqualTo("ai.source-not-found"));
    }

    @Test
    void anUnreadableFileIsAnError() {
        UUID scan = textbook(TextbookFormat.IMAGE, 1);
        when(textbooks.file(scan)).thenReturn(new TextbookContent("a.png", "image/png", 1, new AbstractResource() {
            @Override
            public String getDescription() {
                return "broken";
            }

            @Override
            public InputStream getInputStream() throws IOException {
                throw new IOException("gone");
            }
        }));

        assertThatThrownBy(() -> sources.read(List.of(new TextbookPages(scan, null))))
                .isInstanceOf(java.io.UncheckedIOException.class);
    }

    /** As many bytes as asked for. */
    private static final class SizedResource extends ByteArrayResource {

        SizedResource(long size) {
            super(new byte[Math.toIntExact(size)]);
        }
    }
}
