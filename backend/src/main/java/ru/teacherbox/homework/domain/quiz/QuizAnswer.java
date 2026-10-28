package ru.teacherbox.homework.domain.quiz;

import java.util.UUID;

/** The answer to one question in an attempt; {@code overridden} — the teacher changed {@code correct}. */
public record QuizAnswer(UUID attemptId, UUID questionId, Answer answer, boolean correct, int points,
        boolean overridden) {
}
