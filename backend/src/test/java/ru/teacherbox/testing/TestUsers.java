package ru.teacherbox.testing;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import java.util.UUID;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.shared.security.JwtClaims;
import ru.teacherbox.shared.security.Role;

/** Authenticated MockMvc requests without the identity module (a validated JWT is simulated). */
public final class TestUsers {

    private TestUsers() {
    }

    public static RequestPostProcessor teacher(UUID teacherId) {
        return as(teacherId, Role.TEACHER, "Учитель");
    }

    public static RequestPostProcessor student(UUID studentId) {
        return as(studentId, Role.STUDENT, "Ученик");
    }

    private static RequestPostProcessor as(UUID id, Role role, String name) {
        return jwt()
                .jwt(token -> token.subject(id.toString()).claim(JwtClaims.ROLE, role.name())
                        .claim(JwtClaims.NAME, name))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
}
