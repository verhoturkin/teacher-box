package ru.teacherbox.platform.backup;

import java.time.Duration;
import java.util.function.IntConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Ends the application a moment after the answer is sent, so that the container starts it again
 * ({@code restart: unless-stopped}) and a requested backup is restored on startup (ADR-0014).
 */
public class Restarter {

    /** Not zero: {@code restart: on-failure} restarts it too. */
    static final int EXIT_CODE = 3;

    private static final Logger log = LoggerFactory.getLogger(Restarter.class);

    private final Runnable closeContext;
    private final IntConsumer exit;
    private final Duration delay;

    /**
     * @param closeContext closes the application context (graceful shutdown)
     * @param exit         ends the process with the code
     */
    public Restarter(Runnable closeContext, IntConsumer exit, Duration delay) {
        this.closeContext = closeContext;
        this.exit = exit;
        this.delay = delay;
    }

    public void restartSoon() {
        Thread.ofPlatform().name("teacherbox-restart").start(() -> {
            try {
                Thread.sleep(delay);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            log.warn("Restarting to restore a backup");
            try {
                closeContext.run();
            } finally {
                exit.accept(EXIT_CODE);
            }
        });
    }
}
