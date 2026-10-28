package ru.teacherbox.homework.domain.quiz;

import java.util.UUID;

/** A matching pair: the left side stays in place, the right column is shown shuffled. */
public record Pair(UUID id, String left, String right) {

    public Pair {
        left = Rules.text(left, Question.MAX_ITEM_TEXT, "homework.quiz-option-invalid");
        right = Rules.text(right, Question.MAX_ITEM_TEXT, "homework.quiz-option-invalid");
    }
}
