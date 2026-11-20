package ru.teacherbox.platform.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.web.access.WebInvocationPrivilegeEvaluator;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import ru.teacherbox.shared.security.Role;

/**
 * The roles the URL rules let through to every endpoint of the application, against the checked-in list
 * {@code security/endpoint-roles.txt} (ADR-0069). A new endpoint, or a changed rule, fails here until the list
 * says who may reach it — above all, whether a guardian may. The actual list is written to
 * {@code target/endpoint-roles.txt} to copy over the expectation once the change is intended.
 */
@SpringBootTest
class EndpointRolesTest {

    static final String EXPECTED = "security/endpoint-roles.txt";
    static final String PUBLIC = "PUBLIC";
    static final String NOBODY = "NOBODY";

    @Autowired
    Map<String, RequestMappingHandlerMapping> mappings;

    @Autowired
    WebInvocationPrivilegeEvaluator privileges;

    @Test
    void everyEndpointHasTheExpectedRoles() throws IOException {
        List<String> actual = actual();
        Files.createDirectories(Path.of("target"));
        Files.write(Path.of("target", "endpoint-roles.txt"), actual, StandardCharsets.UTF_8);

        assertThat(actual)
                .as("roles per endpoint differ from %s; the actual list is in target/endpoint-roles.txt", EXPECTED)
                .containsExactlyElementsOf(expected());
    }

    @Test
    void aGuardianReachesOnlyTheirOwnPartOfTheCabinet() throws IOException {
        Set<String> guardianCabinet = actual().stream()
                .filter(line -> line.split(" ")[1].startsWith("/api/me"))
                .filter(line -> line.contains(Role.GUARDIAN.name()))
                .map(line -> line.split(" ")[1])
                .collect(Collectors.toCollection(TreeSet::new));

        assertThat(guardianCabinet).isNotEmpty().allMatch(path -> path.equals("/api/me")
                || path.equals("/api/me/password") || path.equals("/api/me/language")
                || path.equals("/api/me/avatar") || path.startsWith("/api/me/notifications")
                || path.startsWith("/api/me/channels") || path.startsWith("/api/me/push/"));
    }

    @Test
    void theRulesCoverTheParentsAndTheAdministrator() {
        assertThat(roles("GET", "/api/guardian/children")).isEqualTo(Role.GUARDIAN.name());
        assertThat(roles("GET", "/api/me/schedule/lessons")).isEqualTo("STUDENT TEACHER");
        assertThat(roles("PUT", "/api/me/avatar")).isEqualTo("GUARDIAN STUDENT TEACHER");
        assertThat(roles("GET", "/api/me")).isEqualTo("ADMIN GUARDIAN STUDENT TEACHER");
        assertThat(roles("GET", "/api/auth/anything")).isEqualTo(PUBLIC);
        assertThat(roles("GET", "/actuator/env")).isEqualTo(NOBODY);
    }

    private List<String> actual() {
        Set<String> lines = new TreeSet<>();
        for (RequestMappingHandlerMapping mapping : mappings.values()) {
            for (RequestMappingInfo info : mapping.getHandlerMethods().keySet()) {
                Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
                List<String> names = methods.isEmpty()
                        ? List.of("*")
                        : methods.stream().map(Enum::name).sorted().toList();
                for (String pattern : info.getPatternValues()) {
                    for (String method : names) {
                        lines.add(method + " " + pattern + " " + roles(method, pattern));
                    }
                }
            }
        }
        return new ArrayList<>(lines);
    }

    /** Who passes the URL rules: {@code PUBLIC}, {@code NOBODY} or the roles in alphabetical order. */
    private String roles(String method, String pattern) {
        String uri = pattern.replaceAll("\\{[^/]*}", "x").replace("**", "x");
        String httpMethod = method.equals("*") ? "GET" : method;
        Authentication anonymous = new AnonymousAuthenticationToken("key", "anonymous",
                AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS"));
        if (privileges.isAllowed("", uri, httpMethod, anonymous)) {
            return PUBLIC;
        }
        String roles = Arrays.stream(Role.values())
                .filter(role -> privileges.isAllowed("", uri, httpMethod,
                        new TestingAuthenticationToken("user", null, "ROLE_" + role.name())))
                .map(Enum::name)
                .sorted()
                .collect(Collectors.joining(" "));
        return roles.isEmpty() ? NOBODY : roles;
    }

    private List<String> expected() throws IOException {
        try (InputStream in = Objects.requireNonNull(getClass().getClassLoader().getResourceAsStream(EXPECTED),
                EXPECTED)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).lines()
                    .filter(line -> !line.isBlank() && !line.startsWith("#"))
                    .toList();
        }
    }
}
