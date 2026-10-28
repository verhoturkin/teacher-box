package ru.teacherbox.homework.domain.quiz;

import java.util.UUID;

/** A choice option or an ordering item; the id is stable, so a shuffled view leaks nothing. */
public record Option(UUID id, String text) {

    public Option {
        text = Rules.text(text, Question.MAX_ITEM_TEXT, "homework.quiz-option-invalid");
    }
}
