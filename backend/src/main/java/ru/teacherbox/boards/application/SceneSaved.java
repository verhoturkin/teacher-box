package ru.teacherbox.boards.application;

import java.util.UUID;

/**
 * The scene of a board got a new version (a save or a restored copy); inside the module only — the open
 * editors are told to fetch it (ADR-0029).
 */
public record SceneSaved(UUID boardId, long sceneVersion) {
}
