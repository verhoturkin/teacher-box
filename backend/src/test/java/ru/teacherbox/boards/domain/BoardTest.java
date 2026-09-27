package ru.teacherbox.boards.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class BoardTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    @Test
    void namesAnUntitledBoardByItsService() {
        Board holst = Board.added(UUID.randomUUID(), BoardOwner.STUDENT, UUID.randomUUID(), " ",
                " https://app.holst.so/board/42 ", NOW);
        Board other = Board.added(UUID.randomUUID(), BoardOwner.GROUP, UUID.randomUUID(), null,
                "https://miro.com/app/board/1", NOW);

        assertThat(holst.title()).isEqualTo("Доска Холст");
        assertThat(holst.url()).isEqualTo("https://app.holst.so/board/42");
        assertThat(holst.holst()).isTrue();
        assertThat(other.title()).isEqualTo("Доска");
        assertThat(other.holst()).isFalse();
    }

    @Test
    void validatesTitlesAndLinks() {
        Board board = Board.added(UUID.randomUUID(), BoardOwner.STUDENT, UUID.randomUUID(), "Алгебра",
                "https://holst.so/b/1", NOW);

        assertThat(board.changed(" Геометрия ", "https://holst.so/b/2", NOW.plusSeconds(1)).title())
                .isEqualTo("Геометрия");
        assertRule(() -> board.changed(" ", "https://holst.so/b/2", NOW), "boards.title-invalid");
        assertRule(() -> board.changed("x".repeat(201), "https://holst.so/b/2", NOW), "boards.title-invalid");
        for (String bad : new String[] {"ftp://x", "holst", "https://user@holst.so/b", "https://a b",
                "https://x/" + "a".repeat(1000), ""}) {
            assertRule(() -> board.changed("Доска", bad, NOW), "boards.link-invalid");
        }
        assertThat(Board.isHolst("https://a b")).isFalse();
    }

    private static void assertRule(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}
