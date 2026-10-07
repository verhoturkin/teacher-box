package ru.teacherbox.textbooks;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;

/** Small real files for textbook tests. */
public final class TestFiles {

    private TestFiles() {
    }

    /** A PDF of empty A4 pages; the last page may be turned to landscape. */
    public static byte[] pdf(int pages) {
        try (PDDocument document = new PDDocument()) {
            for (int i = 0; i < pages; i++) {
                PDPage page = new PDPage(PDRectangle.A4);
                if (i == pages - 1 && pages > 2) {
                    page.setRotation(90);
                }
                document.addPage(page);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** A wide PDF page (an A3 spread): rendered narrower than 150 dpi would give. */
    public static byte[] widePdf() {
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage(new PDRectangle(PDRectangle.A3.getHeight() * 2, PDRectangle.A3.getWidth())));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static byte[] png() {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(4, 3, BufferedImage.TYPE_INT_RGB), "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** The start of a DOCX (a ZIP archive): enough for the type check. */
    public static byte[] docx() {
        return new byte[] {'P', 'K', 3, 4, 20, 0, 6, 0, 8, 0, 0, 0, 33, 0, 1, 2, 3};
    }

    /** The start of a DOC (an OLE compound file). */
    public static byte[] doc() {
        return new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A,
            (byte) 0xE1, 0, 0, 0, 0};
    }
}
