package ru.teacherbox.identity.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SecureTokensTest {

    @Test
    void generatesUrlSafeUniqueTokens() {
        String first = SecureTokens.generate();
        String second = SecureTokens.generate();

        assertThat(first).hasSize(43).matches("[A-Za-z0-9_-]+").isNotEqualTo(second);
    }

    @Test
    void generatesPasswordsOfSixteenCharacters() {
        assertThat(SecureTokens.generatePassword()).hasSize(16);
    }

    @Test
    void hashesWithSha256() {
        assertThat(SecureTokens.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
