package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.io.UnsupportedEncodingException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.testing.MutableClock;

/** Beans and HTTP helpers for identity integration tests. */
@TestConfiguration
public class IdentityTestSupport {

    public static final String TEACHER_PASSWORD = "teacher-secret-1";
    public static final String COOKIE = "tb_refresh";

    private static final AtomicInteger SEQUENCE = new AtomicInteger();

    @Bean
    MutableClock clock() {
        return MutableClock.startingNow();
    }

    /** Tokens of a signed-in user. */
    public record Tokens(String accessToken, String refreshToken, UUID userId) {

        public String bearer() {
            return "Bearer " + accessToken;
        }

        public Cookie cookie() {
            return new Cookie(COOKIE, refreshToken);
        }
    }

    /** A unique login for test isolation within the shared database. */
    public static String uniqueLogin(String prefix) {
        return prefix + "-" + SEQUENCE.incrementAndGet();
    }

    public static MvcTestResult login(MockMvcTester mvc, String login, String password) {
        return mvc.post().uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"%s\",\"password\":\"%s\"}".formatted(login, password))
                .exchange();
    }

    public static Tokens signIn(MockMvcTester mvc, String login, String password) {
        MvcTestResult result = login(mvc, login, password);
        assertThat(result).hasStatusOk();
        return tokens(result);
    }

    public static Tokens signInTeacher(MockMvcTester mvc) {
        return signIn(mvc, "teacher", TEACHER_PASSWORD);
    }

    /** Extracts the access token (body) and refresh token (cookie) of a session response. */
    public static Tokens tokens(MvcTestResult result) {
        String body = body(result);
        Cookie cookie = result.getResponse().getCookie(COOKIE);
        assertThat(cookie).as("refresh cookie").isNotNull();
        return new Tokens(JsonPath.read(body, "$.accessToken"), cookie.getValue(),
                UUID.fromString(JsonPath.read(body, "$.user.id")));
    }

    public static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString();
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Creates a student and accepts the invitation: returns the student's credentials. */
    public static ActiveStudent activeStudent(StudentAdminService students, InviteService invites, String name) {
        StudentAdminService.CreatedStudent created = students.create(Profile.named(name));
        String login = uniqueLogin("student");
        String password = "password-" + login;
        invites.accept(created.invite().token(), login, password);
        return new ActiveStudent(created.student().id(), login, password);
    }

    public record ActiveStudent(UUID id, String login, String password) {
    }
}
