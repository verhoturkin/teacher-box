package ru.teacherbox.homework.domain;

/** How homework is given and answered; fixed when the assignment is created. */
public enum AssignmentKind {
    /** A text with textbooks and files; answered with a text or files. */
    WRITTEN,
    /** Given and answered on a board; only a description, the student marks it done. */
    BOARD,
    /** An HTML page with its own checks; the student marks it done, the page may report a result. */
    INTERACTIVE
}
