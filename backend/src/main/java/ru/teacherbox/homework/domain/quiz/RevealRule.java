package ru.teacherbox.homework.domain.quiz;

/** When the student sees the correct answers of a quiz; the score itself is always shown after submitting. */
public enum RevealRule {
    AFTER_SUBMIT, AFTER_DUE, NEVER
}
