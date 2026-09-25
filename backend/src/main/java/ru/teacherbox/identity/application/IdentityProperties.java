package ru.teacherbox.identity.application;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import ru.teacherbox.identity.domain.LoginPolicy;

/**
 * Settings of the identity module ({@code TEACHERBOX_IDENTITY_*}).
 *
 * @param teacher           the teacher account created on first start
 * @param accessTokenTtl    lifetime of access tokens (JWT)
 * @param refreshTokenTtl   lifetime of refresh tokens (sliding)
 * @param refreshReuseGrace window in which a just rotated refresh token is still accepted
 *                          (concurrent refreshes from several tabs)
 * @param inviteTtl         lifetime of invitation links
 * @param maxFailedLogins   failed sign-in attempts before a temporary lock
 * @param lockDuration      duration of the lock
 */
@ConfigurationProperties("teacherbox.identity")
public record IdentityProperties(
        @DefaultValue Teacher teacher,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("30d") Duration refreshTokenTtl,
        @DefaultValue("20s") Duration refreshReuseGrace,
        @DefaultValue("7d") Duration inviteTtl,
        @DefaultValue("5") int maxFailedLogins,
        @DefaultValue("15m") Duration lockDuration) {

    /**
     * @param login         teacher login ({@code TEACHERBOX_IDENTITY_TEACHER_LOGIN})
     * @param password      initial password; generated and logged once when empty
     * @param name          display name
     * @param resetPassword when {@code true}, the password is reset to {@code password} on start
     *                      (account recovery)
     */
    public record Teacher(
            @DefaultValue("teacher") String login,
            @Nullable String password,
            @DefaultValue("Учитель") String name,
            @DefaultValue("false") boolean resetPassword) {
    }

    public LoginPolicy loginPolicy() {
        return new LoginPolicy(maxFailedLogins, lockDuration);
    }
}
