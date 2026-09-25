package ru.teacherbox.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Limits {@code POST /api/auth/**} (sign-in, refresh, invitations) per client address with a fixed
 * window. Complements the per-account lockout: it slows down password spraying over many logins.
 * The address honours {@code X-Forwarded-For} from the reverse proxy
 * ({@code server.forward-headers-strategy}).
 */
class AuthRateLimitFilter extends OncePerRequestFilter {

    static final String PATH_PREFIX = "/api/auth/";
    /** Above this many tracked addresses, expired windows are dropped. */
    static final int CLEANUP_THRESHOLD = 10_000;

    private record Window(Instant start, int requests) {
    }

    private final int limit;
    private final Duration period;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    AuthRateLimitFilter(PlatformSecurityProperties.AuthRateLimit settings, Clock clock) {
        this.limit = settings.requests();
        this.period = settings.period();
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return limit <= 0 || !"POST".equals(request.getMethod())
                || !request.getRequestURI().startsWith(PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Instant now = clock.instant();
        Window window = windows.compute(request.getRemoteAddr(), (address, current) ->
                current == null || !now.isBefore(current.start().plus(period))
                        ? new Window(now, 1)
                        : new Window(current.start(), current.requests() + 1));
        if (windows.size() > CLEANUP_THRESHOLD) {
            windows.values().removeIf(old -> !now.isBefore(old.start().plus(period)));
        }
        if (window.requests() > limit) {
            long retryAfter = Math.max(1, Duration.between(now, window.start().plus(period)).toSeconds());
            response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfter));
            ProblemSecurityHandlers.write(response, HttpStatus.TOO_MANY_REQUESTS, "auth.rate-limited",
                    "Too many requests, try again later");
            return;
        }
        chain.doFilter(request, response);
    }

    int trackedAddresses() {
        return windows.size();
    }
}
