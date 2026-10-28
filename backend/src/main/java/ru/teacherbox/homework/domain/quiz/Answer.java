package ru.teacherbox.homework.domain.quiz;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** A student's answer; refers to option ids only. A kind that does not fit the question is simply wrong. */
public sealed interface Answer {

    /** Chosen option ids (one for a single choice). */
    record Choice(Set<UUID> ids) implements Answer {
    }

    record Text(String value) implements Answer {
    }

    record Number(BigDecimal value) implements Answer {
    }

    /** Pair id of the left side → pair id of the right side picked for it. */
    record Pairs(Map<UUID, UUID> matches) implements Answer {
    }

    /** Item ids in the order the student put them. */
    record Order(List<UUID> ids) implements Answer {
    }
}
