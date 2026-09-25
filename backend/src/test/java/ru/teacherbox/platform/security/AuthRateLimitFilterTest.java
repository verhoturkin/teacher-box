package ru.teacherbox.platform.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.ServletException;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import ru.teacherbox.testing.MutableClock;

class AuthRateLimitFilterTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-25T10:00:00Z"));
    private final AuthRateLimitFilter filter = new AuthRateLimitFilter(
            new PlatformSecurityProperties.AuthRateLimit(2, Duration.ofMinutes(1)), clock);

    @Test
    void limitsSignInsPerAddressWithinTheWindow() throws Exception {
        assertThat(post("/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(200);
        assertThat(post("/api/auth/refresh", "10.0.0.1").getStatus()).isEqualTo(200);
        clock.advance(Duration.ofSeconds(20));

        MockHttpServletResponse limited = post("/api/auth/login", "10.0.0.1");

        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getHeader("Retry-After")).isEqualTo("40");
        assertThat(limited.getContentAsString()).contains("\"code\":\"auth.rate-limited\"");
        assertThat(post("/api/auth/login", "10.0.0.2").getStatus()).as("other address").isEqualTo(200);

        clock.advance(Duration.ofSeconds(40));
        assertThat(post("/api/auth/login", "10.0.0.1").getStatus()).as("new window").isEqualTo(200);
    }

    @Test
    void onlyAuthPostsAreLimited() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertThat(request("GET", "/api/auth/invites/x", "10.0.0.3").getStatus()).isEqualTo(200);
            assertThat(request("POST", "/api/teacher/students", "10.0.0.3").getStatus()).isEqualTo(200);
        }
        assertThat(filter.trackedAddresses()).isZero();
    }

    @Test
    void zeroDisablesTheLimit() throws Exception {
        AuthRateLimitFilter disabled = new AuthRateLimitFilter(
                new PlatformSecurityProperties.AuthRateLimit(0, Duration.ofMinutes(1)), clock);

        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            disabled.doFilter(request("/api/auth/login", "10.0.0.4"), response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }

    @Test
    void forgetsExpiredWindowsOfManyAddresses() throws Exception {
        for (int i = 0; i <= AuthRateLimitFilter.CLEANUP_THRESHOLD; i++) {
            post("/api/auth/login", "10.1." + (i / 250) + "." + (i % 250));
        }
        assertThat(filter.trackedAddresses()).isGreaterThan(AuthRateLimitFilter.CLEANUP_THRESHOLD);

        clock.advance(Duration.ofMinutes(2));
        post("/api/auth/login", "10.9.9.9");

        assertThat(filter.trackedAddresses()).isEqualTo(1);
    }

    private MockHttpServletResponse post(String uri, String address) throws ServletException, IOException {
        return request("POST", uri, address);
    }

    private MockHttpServletResponse request(String method, String uri, String address)
            throws ServletException, IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr(address);
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private static MockHttpServletRequest request(String uri, String address) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.setRemoteAddr(address);
        return request;
    }
}
