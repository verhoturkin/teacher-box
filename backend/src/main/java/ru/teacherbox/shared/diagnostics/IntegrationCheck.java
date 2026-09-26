package ru.teacherbox.shared.diagnostics;

import java.util.List;
import java.util.Objects;

/**
 * An external service a module talks to, checked on the administrator's request (SPI): a module
 * provides a bean, {@code platform} collects the results without knowing the modules.
 * A check must not spend money (no AI tokens) and must not throw.
 */
public interface IntegrationCheck {

    List<IntegrationStatus> check();

    enum State {
        OK,
        FAILED,
        /** The integration is switched off in the settings. */
        NOT_CONFIGURED
    }

    /**
     * @param name     what was checked, e.g. {@code Telegram}
     * @param detail   the answer or the error, without secrets
     * @param millis   how long the check took
     */
    record IntegrationStatus(String name, State state, String detail, long millis) {

        public IntegrationStatus {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(state, "state");
            Objects.requireNonNull(detail, "detail");
        }

        public static IntegrationStatus notConfigured(String name, String detail) {
            return new IntegrationStatus(name, State.NOT_CONFIGURED, detail, 0);
        }
    }
}
