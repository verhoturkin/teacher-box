package ru.teacherbox.platform.security;

import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.MethodParameter;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.JwtClaims;
import ru.teacherbox.shared.security.Role;

/** Resolves {@link CurrentUser} controller parameters from the validated access token. */
final class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return CurrentUser.class.equals(parameter.getParameterType());
    }

    @Override
    public CurrentUser resolveArgument(MethodParameter parameter, @Nullable ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest, @Nullable WebDataBinderFactory binderFactory) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            return fromJwt(token.getToken());
        }
        throw new AuthenticationCredentialsNotFoundException("Authentication required");
    }

    static CurrentUser fromJwt(Jwt jwt) {
        String subject = jwt.getSubject();
        String role = jwt.getClaimAsString(JwtClaims.ROLE);
        String name = jwt.getClaimAsString(JwtClaims.NAME);
        if (subject == null || role == null) {
            throw new AuthenticationCredentialsNotFoundException("Access token has no subject or role");
        }
        return new CurrentUser(UUID.fromString(subject), Role.valueOf(role), name == null ? "" : name);
    }
}
