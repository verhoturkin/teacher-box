package ru.teacherbox.boards.application;

import java.util.UUID;

/** The members of a board changed or the board was deleted; inside the module only (ADR-0029). */
public record BoardAccessChanged(UUID boardId) {
}
