package ru.teacherbox.boards.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class BoardTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    @Test
    void anExternalBoardHasALinkAndAnExcalidrawBoardHasNone() {
        Board link = Board.created(UUID.randomUUID(), BoardKind.LINK, " Алгебра ", " https://app.holst.so/board/42 ",
                NOW);
        Board own = Board.created(UUID.randomUUID(), BoardKind.EXCALIDRAW, "Геометрия", "https://ignored.example",
                NOW);

        assertThat(link.title()).isEqualTo("Алгебра");
        assertThat(link.url()).isEqualTo("https://app.holst.so/board/42");
        assertThat(link.excalidraw()).isFalse();
        assertThat(own.url()).isNull();
        assertThat(own.excalidraw()).isTrue();
        assertThat(own.changed("Новая", null, NOW.plusSeconds(1))).satisfies(changed -> {
            assertThat(changed.kind()).isEqualTo(BoardKind.EXCALIDRAW);
            assertThat(changed.updatedAt()).isEqualTo(NOW.plusSeconds(1));
            assertThat(changed.createdAt()).isEqualTo(NOW);
        });
    }

    @Test
    void validatesTitlesAndLinks() {
        Board board = Board.created(UUID.randomUUID(), BoardKind.LINK, "Алгебра", "https://holst.so/b/1", NOW);

        assertThat(board.changed(" Геометрия ", "http://miro.com/b/2", NOW).title()).isEqualTo("Геометрия");
        assertRule(() -> board.changed(" ", "https://holst.so/b/2", NOW), "boards.title-invalid");
        assertRule(() -> board.changed("x".repeat(201), "https://holst.so/b/2", NOW), "boards.title-invalid");
        assertRule(() -> Board.created(UUID.randomUUID(), BoardKind.EXCALIDRAW, null, null, NOW),
                "boards.title-invalid");
        for (String bad : new String[] {"ftp://x", "holst", "https://user@holst.so/b", "https://a b",
                "https://x/" + "a".repeat(1000), ""}) {
            assertRule(() -> board.changed("Доска", bad, NOW), "boards.link-invalid");
        }
        assertRule(() -> board.changed("Доска", null, NOW), "boards.link-invalid");
    }

    private static void assertRule(ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}
