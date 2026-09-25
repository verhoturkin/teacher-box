package ru.teacherbox.platform.web;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.error.UnauthorizedException;

class ProblemDetailsAdviceTest {

    private final MockMvcTester mvc = MockMvcTester.create(MockMvcBuilders
            .standaloneSetup(new ThrowingController())
            .setControllerAdvice(new ProblemDetailsAdvice())
            .build());

    @Test
    void mapsDomainExceptionsToStatusAndCode() {
        assertProblem("/not-found", HttpStatus.NOT_FOUND, "thing.not-found");
        assertProblem("/conflict", HttpStatus.CONFLICT, "thing.exists");
        assertProblem("/forbidden", HttpStatus.FORBIDDEN, "thing.forbidden");
        assertProblem("/rule", HttpStatus.UNPROCESSABLE_CONTENT, "thing.rule");
        assertProblem("/unauthorized", HttpStatus.UNAUTHORIZED, "thing.credentials");
    }

    @Test
    void mapsInfrastructureExceptions() {
        assertProblem("/optimistic", HttpStatus.CONFLICT, "concurrent.modification");
        assertProblem("/access-denied", HttpStatus.FORBIDDEN, "access.denied");
        assertProblem("/unauthenticated", HttpStatus.UNAUTHORIZED, "auth.required");
        assertProblem("/illegal", HttpStatus.BAD_REQUEST, "request.invalid");
        assertProblem("/unexpected", HttpStatus.INTERNAL_SERVER_ERROR, "internal.error");
    }

    @Test
    void domainProblemContainsMessageAsDetail() {
        assertThat(mvc.get().uri("/not-found"))
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().extractingPath("$.detail").isEqualTo("Thing not found");
    }

    @Test
    void validationErrorsListFields() {
        assertThat(mvc.post().uri("/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.code").isEqualTo("validation.failed");
                    assertThat(json).extractingPath("$.errors.name").isNotNull();
                });
    }

    @Test
    void standardSpringErrorsStayProblemDetails() {
        assertThat(mvc.post().uri("/validate").contentType(MediaType.APPLICATION_JSON).content("not json"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
    }

    private void assertProblem(String uri, HttpStatus status, String code) {
        assertThat(mvc.get().uri(uri))
                .hasStatus(status)
                .bodyJson().extractingPath("$.code").isEqualTo(code);
    }

    record NameRequest(@NotBlank String name) {
    }

    @RestController
    static class ThrowingController {

        @GetMapping("/not-found")
        void notFound() {
            throw new NotFoundException("thing.not-found", "Thing not found");
        }

        @GetMapping("/conflict")
        void conflict() {
            throw new ConflictException("thing.exists", "Thing exists");
        }

        @GetMapping("/forbidden")
        void forbidden() {
            throw new ForbiddenException("thing.forbidden", "Forbidden");
        }

        @GetMapping("/rule")
        void rule() {
            throw new BusinessRuleException("thing.rule", "Rule violated");
        }

        @GetMapping("/unauthorized")
        void unauthorized() {
            throw new UnauthorizedException("thing.credentials", "Wrong credentials");
        }

        @GetMapping("/optimistic")
        void optimistic() {
            throw new OptimisticLockingFailureException("stale");
        }

        @GetMapping("/access-denied")
        void accessDenied() {
            throw new AccessDeniedException("no");
        }

        @GetMapping("/unauthenticated")
        void unauthenticated() {
            throw new AuthenticationCredentialsNotFoundException("no");
        }

        @GetMapping("/illegal")
        void illegal() {
            throw new IllegalArgumentException("bad input");
        }

        @GetMapping("/unexpected")
        void unexpected() {
            throw new IllegalStateException("bug");
        }

        @PostMapping("/validate")
        void validate(@Valid @RequestBody NameRequest request) {
            // validation happens before the call
        }
    }
}
