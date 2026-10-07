package ru.teacherbox.textbooks.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;

class TextbookTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");
    private static final TextbookFile PDF = new TextbookFile("k1", "a.pdf", "application/pdf", 10, TextbookFormat.PDF);
    private static final TextbookFile DOCX = new TextbookFile("k2", "a.docx", "application/x", 10,
            TextbookFormat.DOCUMENT);
    private static final TextbookFile PNG = new TextbookFile("k3", "a.png", "image/png", 10, TextbookFormat.IMAGE);

    @Test
    void countsPagesByTheFile() {
        assertThat(created(PDF, 12, 30).pageCount()).isEqualTo(30);
        assertThat(created(PNG, 12, 1).pageCount()).isEqualTo(1);
        assertThat(created(DOCX, 12, 1).pageCount()).isEqualTo(12);
        assertThat(created(DOCX, null, 1).pageCount()).isNull();
        assertThat(created(PDF, null, 3).paged()).isTrue();
        assertThat(created(DOCX, null, 3).paged()).isFalse();
    }

    @Test
    void keepsTheTeachersCountOnlyForDocuments() {
        Textbook document = created(DOCX, 12, 1);
        assertThat(document.changed(TextbookKind.OTHER, "Т", null, 15, NOW).pageCount()).isEqualTo(15);
        assertThat(document.withFile(DOCX, 1, NOW).pageCount()).isEqualTo(12);
        assertThat(document.withFile(PDF, 7, NOW).pageCount()).isEqualTo(7);
        Textbook pdf = created(PDF, null, 7);
        assertThat(pdf.changed(TextbookKind.OTHER, "Т", null, 15, NOW).pageCount()).isEqualTo(7);
        assertThat(pdf.withFile(DOCX, 1, NOW).pageCount()).isNull();
    }

    @Test
    void checksItsFields() {
        assertThatThrownBy(() -> Textbook.created(UUID.randomUUID(), TextbookKind.OTHER, "x".repeat(201), null, null,
                PNG, 1, NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> Textbook.created(UUID.randomUUID(), TextbookKind.OTHER, null, null, null, PNG, 1,
                NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> Textbook.created(UUID.randomUUID(), TextbookKind.OTHER, "T", "к".repeat(101), null,
                PNG, 1, NOW)).hasFieldOrPropertyWithValue("code", "textbooks.course-invalid");
        assertThatThrownBy(() -> created(DOCX, 0, 1)).hasFieldOrPropertyWithValue("code",
                "textbooks.page-count-invalid");
        assertThatThrownBy(() -> created(DOCX, 10_001, 1)).isInstanceOf(BusinessRuleException.class);
        assertThat(Textbook.created(UUID.randomUUID(), TextbookKind.OTHER, "T", "  Алгебра ", null, PNG, 1, NOW)
                .course()).isEqualTo("Алгебра");
    }

    @Test
    void findsTheTypeByTheFirstBytes() {
        assertThat(TextbookFiles.typeOf("x.bin", ascii("GIF89a")).contentType()).isEqualTo("image/gif");
        assertThat(TextbookFiles.typeOf("x", ascii("RIFF0000WEBPVP8 ")).contentType()).isEqualTo("image/webp");
        assertThatThrownBy(() -> TextbookFiles.typeOf("x", ascii("RIFF0000WAVE")))
                .hasFieldOrPropertyWithValue("code", "textbooks.file-type-not-allowed");
    }

    @Test
    void cleansFileNames() {
        assertThat(TextbookFiles.cleanFilename("C:\\docs\\Учебник.pdf")).isEqualTo("Учебник.pdf");
        assertThat(TextbookFiles.cleanFilename("../")).isEqualTo("file");
        assertThat(TextbookFiles.cleanFilename(null)).isEqualTo("file");
        assertThat(TextbookFiles.cleanFilename("a\u0001b.pdf")).isEqualTo("ab.pdf");
        assertThat(TextbookFiles.cleanFilename("я".repeat(300) + ".pdf")).hasSize(255).endsWith(".pdf");
        assertThat(TextbookFiles.cleanFilename("я".repeat(300))).hasSize(255);
        assertThatThrownBy(() -> TextbookFiles.checkSize(TextbookFiles.MAX_SIZE + 1))
                .hasFieldOrPropertyWithValue("code", "textbooks.file-too-large");
    }

    private static Textbook created(TextbookFile file, Integer pageCount, int filePages) {
        return Textbook.created(UUID.randomUUID(), TextbookKind.TEXTBOOK, "Учебник", null, pageCount, file, filePages,
                NOW);
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }
}
