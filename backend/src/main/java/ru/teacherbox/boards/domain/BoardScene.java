package ru.teacherbox.boards.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The stored scene of an Excalidraw board.
 *
 * @param elements  JSON array of the elements, tombstones included
 * @param appState  JSON object, the whitelisted part of the appState ({@link SceneElements#APP_STATE_KEYS})
 * @param version   grows by one with every save that changed the scene
 * @param updatedBy the user who changed it last; {@code null} for a new board
 */
public record BoardScene(UUID boardId, String elements, String appState, long version, Instant updatedAt,
        @Nullable UUID updatedBy) {

    public static BoardScene empty(UUID boardId, Instant now) {
        return new BoardScene(boardId, "[]", "{}", 0, now, null);
    }
}
