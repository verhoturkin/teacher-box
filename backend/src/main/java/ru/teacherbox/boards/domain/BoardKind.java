package ru.teacherbox.boards.domain;

/** What a board is (ADR-0028). */
public enum BoardKind {
    /** Our own Excalidraw board: the scene and images live in the portal. */
    EXCALIDRAW,
    /** An external board (Холст or any other): a title and a link, nothing more. */
    LINK
}
