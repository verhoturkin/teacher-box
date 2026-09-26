package ru.teacherbox.platform.admin;

import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.IntegrationStatus;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.State;

/** Runs the integration checks that the modules provide ({@link IntegrationCheck} beans). */
public class IntegrationChecks {

    private static final Logger log = LoggerFactory.getLogger(IntegrationChecks.class);

    private final ObjectProvider<IntegrationCheck> checks;

    public IntegrationChecks(ObjectProvider<IntegrationCheck> checks) {
        this.checks = checks;
    }

    public List<IntegrationStatus> run() {
        return checks.orderedStream()
                .flatMap(check -> safely(check).stream())
                .sorted(Comparator.comparing(IntegrationStatus::name))
                .toList();
    }

    private static List<IntegrationStatus> safely(IntegrationCheck check) {
        try {
            return check.check();
        } catch (RuntimeException e) {
            log.warn("Integration check {} failed", check.getClass().getSimpleName(), e);
            return List.of(new IntegrationStatus(check.getClass().getSimpleName(), State.FAILED,
                    String.valueOf(e.getMessage()), 0));
        }
    }
}
