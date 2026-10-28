package ru.teacherbox.homework.domain.quiz;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * An auto-checked question of an assignment (ADR-0052). {@link #check} is pure: right or wrong, all or nothing,
 * worth {@link #points()}.
 */
public sealed interface Question permits SingleChoice, MultipleChoice, ShortText, Numeric, Matching, Ordering {

    int MAX_TEXT = 2000;
    int MAX_ITEM_TEXT = 500;
    int MIN_ITEMS = 2;
    int MAX_ITEMS = 10;
    int MAX_POINTS = 100;

    UUID id();

    QuestionType type();

    String text();

    int points();

    @Nullable String explanation();

    boolean check(Answer answer);
}
