package ru.teacherbox.schedule.domain;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A student taking part in a lesson.
 *
 * @param completionId id of the charge of a charged attendance; a new one for every change, so that
 *                     the previous charge can be revoked
 */
public record Participant(UUID studentId, Attendance attendance, @Nullable UUID completionId) {

    public Participant {
        Objects.requireNonNull(studentId);
        Objects.requireNonNull(attendance);
        if (attendance.isCharged() != (completionId != null)) {
            throw new IllegalArgumentException("Only a charged attendance has a completion id");
        }
    }

    static Participant expected(UUID studentId) {
        return new Participant(studentId, Attendance.EXPECTED, null);
    }

    /**
     * A change of the attendance of one participant.
     *
     * @param revokedCompletionId the charge to revoke, if the participant was charged before
     * @param newCompletionId     the new charge, if the new attendance is charged
     */
    public record Change(UUID studentId, Attendance attendance, @Nullable UUID revokedCompletionId,
            @Nullable UUID newCompletionId) {

        public boolean missed() {
            return attendance == Attendance.MISSED;
        }
    }
}
