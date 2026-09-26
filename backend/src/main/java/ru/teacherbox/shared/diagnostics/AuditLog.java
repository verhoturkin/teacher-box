package ru.teacherbox.shared.diagnostics;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Administrator actions, written to the application log under the logger {@value #LOGGER} so that
 * they can be found in the log search (ADR-0010). Details must not contain personal data.
 */
public final class AuditLog {

    public static final String LOGGER = "teacherbox.audit";

    private static final Logger log = LoggerFactory.getLogger(LOGGER);

    private AuditLog() {
    }

    /**
     * @param actorId who did it
     * @param action  short name, e.g. {@code log-level}
     * @param details what exactly, e.g. {@code ru.teacherbox.notifications=DEBUG for 30 min}
     */
    public static void record(UUID actorId, String action, String details) {
        log.info("Administrator {}: {} ({})", actorId, action, details);
    }
}
