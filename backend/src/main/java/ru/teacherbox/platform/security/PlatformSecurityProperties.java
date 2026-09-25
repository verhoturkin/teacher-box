package ru.teacherbox.platform.security;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param jwtSecret optional HMAC secret for access tokens ({@code TEACHERBOX_SECURITY_JWT_SECRET});
 *                  when absent, a key is generated once and kept in {@code <data-dir>/keys}
 */
@ConfigurationProperties("teacherbox.security")
public record PlatformSecurityProperties(@Nullable String jwtSecret) {
}
