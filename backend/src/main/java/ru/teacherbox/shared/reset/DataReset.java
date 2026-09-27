package ru.teacherbox.shared.reset;

import java.util.List;
import java.util.Optional;

/**
 * A full reset of the portal (ADR-0014): every module deletes its own data, the platform knows
 * nothing about the modules' tables. {@link #erase()} of all modules runs in one transaction; the
 * files of the modules are deleted by the platform afterwards.
 */
public interface DataReset {

    /**
     * Every table of the module's schema, e.g. {@code billing.lessons}: a test checks that no table is
     * forgotten.
     */
    List<String> tables();

    /** Deletes the module's data (what has to stay, e.g. the teacher's account, stays). */
    void erase();

    /**
     * After the transaction: external services and caches. Must not fail.
     *
     * @return what the teacher should do by hand, e.g. delete a calendar in Google
     */
    default Optional<String> afterErase() {
        return Optional.empty();
    }
}
