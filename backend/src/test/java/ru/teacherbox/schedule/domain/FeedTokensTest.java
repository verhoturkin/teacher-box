package ru.teacherbox.schedule.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FeedTokensTest {

    @Test
    void generatesUrlSafeRandomTokens() {
        String token = FeedTokens.generate();

        assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
        assertThat(FeedTokens.generate()).isNotEqualTo(token);
        assertThat(FeedTokens.isWellFormed(token)).isTrue();
        assertThat(FeedTokens.isWellFormed("short")).isFalse();
        assertThat(FeedTokens.isWellFormed(token.substring(1) + "/")).isFalse();
    }

    @Test
    void hashesWithSha256() {
        assertThat(FeedTokens.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
