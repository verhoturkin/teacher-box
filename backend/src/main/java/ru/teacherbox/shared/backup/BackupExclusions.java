package ru.teacherbox.shared.backup;

import java.util.List;
import java.util.Set;

/**
 * What a module leaves out of the portal backup (ADR-0037): history it can do without, so that
 * backups do not grow with it. The platform collects every bean and knows nothing about the tables.
 */
public interface BackupExclusions {

    /** Tables of the module's schema, e.g. {@code boards.board_backups}, whose rows stay out; the tables stay. */
    List<String> tables();

    /** The module's namespace in {@code FileStorage}. */
    String namespace();

    /** Keys of the module's files that stay out; asked right before the database is written. */
    Set<String> files();
}
