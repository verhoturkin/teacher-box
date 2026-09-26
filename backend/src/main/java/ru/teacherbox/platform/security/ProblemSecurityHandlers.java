package ru.teacherbox.platform.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import ru.teacherbox.platform.web.RequestIdFilter;

/** 401/403 responses from the security filter chain in the same ProblemDetail format as the API. */
final class ProblemSecurityHandlers {

    private ProblemSecurityHandlers() {
    }

    static AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, exception) -> {
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
            write(response, HttpStatus.UNAUTHORIZED, "auth.required", "Authentication required");
        };
    }

    static AccessDeniedHandler accessDeniedHandler() {
        return (request, response, exception) ->
                write(response, HttpStatus.FORBIDDEN, "access.denied", "Access denied");
    }

    static void write(HttpServletResponse response, HttpStatus status, String code, String detail)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        String requestId = RequestIdFilter.current();
        response.getWriter().write("""
                {"type":"about:blank","title":"%s","status":%d,"detail":"%s","code":"%s"%s}"""
                .formatted(status.getReasonPhrase(), status.value(), detail, code,
                        requestId == null ? "" : ",\"requestId\":\"" + requestId + "\""));
    }
}
