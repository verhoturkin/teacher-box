package ru.teacherbox.homework.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Checks questions drafted by the AI against the rules of a quiz (ADR-0052) and gives them ids. */
public interface QuizDrafts {

    /**
     * The valid questions among the drafted ones, in order; an invalid question is dropped, not repaired.
     *
     * @param type one of {@code SINGLE_CHOICE, MULTIPLE_CHOICE, SHORT_TEXT, NUMBER, MATCHING, ORDERING}
     */
    List<Drafted> validate(List<Draft> drafts);

    /**
     * A question as the model wrote it; which fields count depends on the type.
     *
     * @param options choices, or the items of an ordering in the right order
     * @param correct 0-based indexes of the right options
     */
    record Draft(String type, @Nullable String text, @Nullable Integer points, @Nullable String explanation,
            @Nullable List<String> options, @Nullable List<Integer> correct, @Nullable List<String> accepted,
            @Nullable BigDecimal value, @Nullable BigDecimal tolerance, @Nullable List<DraftPair> pairs) {
    }

    record DraftPair(@Nullable String left, @Nullable String right) {
    }

    /** A valid question in the shape of the assignment editor's request (ids new). */
    record Drafted(UUID id, String type, String text, int points, @Nullable String explanation,
            List<Item> options, List<UUID> correct, List<String> accepted, @Nullable BigDecimal value,
            @Nullable BigDecimal tolerance, List<DraftedPair> pairs) {
    }

    record Item(UUID id, String text) {
    }

    record DraftedPair(UUID id, String left, String right) {
    }
}
