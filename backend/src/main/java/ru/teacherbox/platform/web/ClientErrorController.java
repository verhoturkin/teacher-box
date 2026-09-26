package ru.teacherbox.platform.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Errors of the browser application, written to the server log (ADR-0010) so that the administrator sees
 * them next to the server errors. Open without sign-in, therefore limited: a few reports per minute from
 * one address and a cap for everybody.
 */
@RestController
class ClientErrorController {

    static final String LOGGER = "ru.teacherbox.client";
    static final int PER_ADDRESS = 10;
    static final int TOTAL = 100;
    static final Duration WINDOW = Duration.ofMinutes(1);

    private static final Logger log = LoggerFactory.getLogger(LOGGER);

    /** @param url the page where the error happened */
    record ClientError(@NotBlank @Size(max = 2_000) String message, @Size(max = 1_000) @Nullable String url,
            @Size(max = 10_000) @Nullable String stack) {
    }

    private record Window(Instant start, AtomicInteger count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    ClientErrorController(Clock clock) {
        this.clock = clock;
    }

    @PostMapping("/api/client-errors")
    ResponseEntity<Void> report(@Valid @RequestBody ClientError error, HttpServletRequest request) {
        if (!allowed(request.getRemoteAddr())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        log.warn("Browser error on {} (user {}): {}{}", error.url() == null ? "?" : error.url(), user(),
                error.message(), error.stack() == null ? "" : "\n" + error.stack());
        return ResponseEntity.noContent().build();
    }

    private boolean allowed(String address) {
        Instant now = clock.instant();
        if (windows.size() > 10_000) {
            windows.clear();
        }
        return count(address, now) <= PER_ADDRESS && count("*", now) <= TOTAL;
    }

    private int count(String key, Instant now) {
        Window window = windows.compute(key, (name, current) ->
                current == null || !now.isBefore(current.start().plus(WINDOW))
                        ? new Window(now, new AtomicInteger())
                        : current);
        return window.count().incrementAndGet();
    }

    private static String user() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null || authentication instanceof AnonymousAuthenticationToken
                ? "anonymous"
                : authentication.getName();
    }
}
