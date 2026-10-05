package ru.teacherbox.boards.domain;

import java.time.Instant;
import java.util.UUID;

/** A copy of a board's scene (ADR-0028): daily or made by the teacher. */
public record BoardBackup(UUID id, UUID boardId, BackupKind kind, String elements, String appState,
        long sceneVersion, Instant createdAt) {
}
