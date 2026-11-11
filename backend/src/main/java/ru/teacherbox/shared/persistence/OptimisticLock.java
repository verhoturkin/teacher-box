package ru.teacherbox.shared.persistence;

import org.springframework.dao.OptimisticLockingFailureException;

/** The check after {@code update … where id = :id and version = :version}. */
public final class OptimisticLock {

    private OptimisticLock() {
    }

    /**
     * @param affected rows the statement changed
     * @param entity   what was saved, for the message ("Lesson")
     * @param id       its identifier (logs hold IDs only)
     * @throws OptimisticLockingFailureException unless exactly one row was changed
     */
    public static void requireUpdated(int affected, String entity, Object id) {
        if (affected != 1) {
            throw new OptimisticLockingFailureException(entity + " " + id + " was modified");
        }
    }
}
