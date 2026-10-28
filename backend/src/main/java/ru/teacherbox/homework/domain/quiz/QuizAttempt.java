package ru.teacherbox.homework.domain.quiz;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** One try of a student; the score fields are set on submit. */
public record QuizAttempt(UUID id, UUID taskId, Instant startedAt, @Nullable Instant submittedAt,
        @Nullable Integer scorePoints, @Nullable Integer maxPoints) {
}
