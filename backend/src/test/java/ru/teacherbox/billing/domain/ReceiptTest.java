package ru.teacherbox.billing.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class ReceiptTest {

    @Test
    void recognizesPicturesAndPdfsByTheirFirstBytes() {
        assertThat(Receipt.typeOf(bytes(0xFF, 0xD8, 0xFF, 0xE0))).contains("image/jpeg");
        assertThat(Receipt.typeOf(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A))).contains("image/png");
        assertThat(Receipt.typeOf(ascii("RIFF\0\0\0\0WEBPVP8 "))).contains("image/webp");
        assertThat(Receipt.typeOf(ascii("\0\0\0\u0018ftypheic"))).contains("image/heic");
        assertThat(Receipt.typeOf(ascii("\0\0\0\u0018ftypmif1"))).contains("image/heic");
        assertThat(Receipt.typeOf(ascii("\0\0\0\u0018ftypisom"))).isEmpty();
        assertThat(Receipt.typeOf(ascii("RIFF\0\0\0\0WAVE"))).isEmpty();
        assertThat(Receipt.typeOf(ascii("%PDF-1.4"))).contains("application/pdf");
        assertThat(Receipt.typeOf(ascii("<html>"))).isEmpty();
        assertThat(Receipt.typeOf(new byte[0])).isEmpty();
    }

    @Test
    void namesTheFileWithTheExtensionOfItsType() {
        assertThat(Receipt.filename("C:\\Downloads\\чек.JPEG", "image/jpeg")).isEqualTo("чек.jpeg");
        assertThat(Receipt.filename("../scan.png", "image/jpeg")).isEqualTo("scan.jpg");
        assertThat(Receipt.filename("Чек от 01.10", "image/webp")).isEqualTo("Чек от 01.10.webp");
        assertThat(Receipt.filename("  ", "application/pdf")).isEqualTo("receipt.pdf");
        assertThat(Receipt.filename("photo", "image/heic")).isEqualTo("photo.heic");
        assertThat(Receipt.filename("x".repeat(300) + ".png", "image/png")).hasSize(Receipt.MAX_FILENAME);
    }

    @Test
    void refusesOtherFiles() {
        byte[] pdf = ascii("%PDF-1.4");
        assertThat(Receipt.of("k", "a.pdf", pdf, 100).contentType()).isEqualTo("application/pdf");
        assertThatThrownBy(() -> Receipt.of("k", "a.pdf", pdf, 0))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "receipt.empty");
        assertThatThrownBy(() -> Receipt.of("k", "a.pdf", pdf, Receipt.MAX_SIZE + 1))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "receipt.too-large");
        assertThatThrownBy(() -> Receipt.of("k", "a.txt", ascii("hello"), 5))
                .isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "receipt.type-not-allowed");
    }

    private static byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = (byte) values[i];
        }
        return result;
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.ISO_8859_1);
    }
}
