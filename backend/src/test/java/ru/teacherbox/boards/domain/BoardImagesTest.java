package ru.teacherbox.boards.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class BoardImagesTest {

    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13};

    @Test
    void takesRasterImagesWhoseBytesMatchTheirType() {
        assertThat(BoardImages.contentType("image/png", PNG)).isEqualTo("image/png");
        assertThat(BoardImages.contentType("IMAGE/JPEG; q=1", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}))
                .isEqualTo("image/jpeg");
        assertThat(BoardImages.contentType("image/gif", "GIF89a".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo("image/gif");
        assertThat(BoardImages.contentType("image/webp", "RIFF0000WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo("image/webp");
    }

    @Test
    void rejectsSvgOtherTypesAndForgedBytes() {
        byte[] svg = "<svg xmlns=".getBytes(StandardCharsets.US_ASCII);
        assertRule(() -> BoardImages.contentType("image/svg+xml", svg), "boards.file-type-not-allowed");
        assertRule(() -> BoardImages.contentType("image/png", svg), "boards.file-type-not-allowed");
        assertRule(() -> BoardImages.contentType(null, PNG), "boards.file-type-not-allowed");
        assertRule(() -> BoardImages.contentType("image/webp", "RIFF".getBytes(StandardCharsets.US_ASCII)),
                "boards.file-type-not-allowed");
    }

    @Test
    void checksFileIdsAndSizes() {
        assertThat(BoardImages.validFileId("a1_B-2")).isEqualTo("a1_B-2");
        assertRule(() -> BoardImages.validFileId("../x"), "boards.file-id-invalid");
        assertRule(() -> BoardImages.validFileId("x".repeat(101)), "boards.file-id-invalid");
        BoardImages.checkSize(BoardImages.MAX_SIZE);
        assertRule(() -> BoardImages.checkSize(BoardImages.MAX_SIZE + 1), "boards.file-too-large");
    }

    private static void assertRule(ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}
