package ru.teacherbox.ai.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;

public class PdfPicturesTest {

    /** A PDF of blank A6 pages. */
    public static byte[] pdf(int pages) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int page = 0; page < pages; page++) {
                document.addPage(new PDPage(PDRectangle.A6));
            }
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Test
    void drawsPagesAsPngUpToTheLimit() {
        assertThat(PdfPictures.render(pdf(3), 2)).hasSize(2).allSatisfy(png ->
                assertThat(png).startsWith(0x89, 'P', 'N', 'G'));
    }

    @Test
    void aBrokenPdfMakesTheRequestUnusable() {
        assertThatThrownBy(() -> PdfPictures.render(new byte[] {1, 2, 3}, 5))
                .isInstanceOfSatisfying(LlmException.class,
                        e -> assertThat(e.reason()).isEqualTo(LlmException.Reason.UNAVAILABLE));
    }
}
