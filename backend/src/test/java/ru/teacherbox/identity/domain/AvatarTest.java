package ru.teacherbox.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class AvatarTest {

    @Test
    void recognizesPhotosByTheirFirstBytes() {
        assertThat(Avatar.detectType(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0})).contains("image/png");
        assertThat(Avatar.detectType(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0})).contains("image/jpeg");
        assertThat(Avatar.detectType("RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)))
                .contains("image/webp");
    }

    @Test
    void rejectsEverythingElse() {
        assertThat(Avatar.detectType(new byte[0])).isEmpty();
        assertThat(Avatar.detectType(new byte[] {(byte) 0x89, 'P'})).isEmpty();
        assertThat(Avatar.detectType("RIFF\0\0\0\0WAVEfmt ".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(Avatar.detectType("RIFF".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(Avatar.detectType("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8)))
                .isEmpty();
    }
}
