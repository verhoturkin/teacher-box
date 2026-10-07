package ru.teacherbox.textbooks.application;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessRead;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.io.RandomAccessReadBufferedFile;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** Pages of a PDF with PDFBox (ADR-0033): counted, cut out into a new PDF, rendered as pictures. */
@Component
class PdfPages {

    /** Resolution of a page picture: enough to read small print on a board. */
    static final float DPI = 150;
    /** The widest page picture, pixels: a wide spread is rendered smaller. */
    static final int MAX_WIDTH = 2000;

    private static final float POINTS_PER_INCH = 72;

    /** @throws BusinessRuleException {@code textbooks.pdf-unreadable} for a broken or password-protected PDF */
    int count(Resource pdf) {
        try (PDDocument document = load(pdf)) {
            return document.getNumberOfPages();
        } catch (IOException e) {
            throw unreadable();
        }
    }

    /**
     * @param pages page numbers from 1; those past the end are skipped
     * @return a PDF with these pages
     * @throws BusinessRuleException {@code textbooks.pages-beyond} when none of them is in the file
     */
    byte[] cut(Resource pdf, List<Integer> pages) {
        try (PDDocument source = load(pdf); PDDocument cut = new PDDocument()) {
            int count = source.getNumberOfPages();
            for (int page : pages) {
                if (page >= 1 && page <= count) {
                    cut.importPage(source.getPage(page - 1));
                }
            }
            if (cut.getNumberOfPages() == 0) {
                throw new BusinessRuleException("textbooks.pages-beyond", "The textbook has " + count + " pages");
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            cut.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw unreadable();
        }
    }

    /**
     * @param page the page number from 1
     * @return the page as a PNG at {@link #DPI}, at most {@link #MAX_WIDTH} wide
     * @throws NotFoundException {@code textbooks.page-not-found} past the end
     */
    byte[] picture(Resource pdf, int page) {
        try (PDDocument document = load(pdf)) {
            if (page < 1 || page > document.getNumberOfPages()) {
                throw TextbookService.pageNotFound();
            }
            PDPage pdPage = document.getPage(page - 1);
            PDRectangle box = pdPage.getCropBox();
            boolean turned = pdPage.getRotation() % 180 != 0;
            float widthInches = (turned ? box.getHeight() : box.getWidth()) / POINTS_PER_INCH;
            float dpi = widthInches * DPI > MAX_WIDTH ? MAX_WIDTH / widthInches : DPI;
            BufferedImage image = new PDFRenderer(document).renderImageWithDPI(page - 1, dpi, ImageType.RGB);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw unreadable();
        }
    }

    private static PDDocument load(Resource pdf) throws IOException {
        RandomAccessRead read = pdf.isFile()
                ? new RandomAccessReadBufferedFile(pdf.getFile())
                : new RandomAccessReadBuffer(pdf.getInputStream());
        return Loader.loadPDF(read);
    }

    private static BusinessRuleException unreadable() {
        return new BusinessRuleException("textbooks.pdf-unreadable",
                "The PDF cannot be read: it is broken or protected by a password");
    }
}
