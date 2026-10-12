package ru.teacherbox.ai.application;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;

/**
 * Pages of a PDF as PNG pictures, for providers that read pictures but not PDF files (ADR-0039): 100 dpi is enough
 * to read a textbook page and keeps the request small.
 */
public final class PdfPictures {

    static final float DPI = 100;

    private PdfPictures() {
    }

    /** @throws LlmException {@code UNAVAILABLE} if the PDF cannot be read */
    public static List<byte[]> render(byte[] pdf, int maxPages) {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFRenderer renderer = new PDFRenderer(document);
            int pages = Math.min(document.getNumberOfPages(), maxPages);
            List<byte[]> pictures = new ArrayList<>(pages);
            for (int page = 0; page < pages; page++) {
                BufferedImage image = renderer.renderImageWithDPI(page, DPI, ImageType.RGB);
                ByteArrayOutputStream png = new ByteArrayOutputStream();
                ImageIO.write(image, "png", png);
                pictures.add(png.toByteArray());
            }
            return pictures;
        } catch (IOException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE, "The PDF cannot be read: " + e.getMessage());
        }
    }
}
