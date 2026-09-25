package ru.teacherbox.platform.security;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param jwtSecret     optional HMAC secret for access tokens ({@code TEACHERBOX_SECURITY_JWT_SECRET});
 *                      when absent, a key is generated once and kept in {@code <data-dir>/keys}
 * @param authRateLimit limit of {@code POST /api/auth/**} requests per client address
 */
@ConfigurationProperties("teacherbox.security")
public record PlatformSecurityProperties(
        @Nullable String jwtSecret,
        @DefaultValue AuthRateLimit authRateLimit) {

    /**
     * @param requests requests allowed per {@code period}; {@code 0} disables the limit
     */
    public record AuthRateLimit(@DefaultValue("30") int requests, @DefaultValue("1m") Duration period) {
    }
}
