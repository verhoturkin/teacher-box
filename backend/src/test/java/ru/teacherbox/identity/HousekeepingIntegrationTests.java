package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.application.IdentityHousekeeping;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;

/** Nightly removal of expired refresh tokens and invitations. */
@IdentityIntegrationTest
class HousekeepingIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    IdentityHousekeeping housekeeping;

    @Autowired
    StudentAdminService students;

    @Test
    void keepsLiveTokensAndInvitations() {
        IdentityTestSupport.Tokens session = IdentityTestSupport.signInTeacher(mvc);
        String invite = students.create(Profile.named("Свежий")).invite().token();

        housekeeping.purge(Instant.now());

        assertThat(mvc.post().uri("/api/auth/refresh").cookie(session.cookie())).hasStatusOk();
        assertThat(mvc.get().uri("/api/auth/invites/" + invite)).hasStatusOk();
    }

    @Test
    void removesExpiredTokensAndOldInvitations() {
        IdentityTestSupport.Tokens session = IdentityTestSupport.signInTeacher(mvc);
        String invite = students.create(Profile.named("Забытый")).invite().token();

        assertThat(housekeeping.purge(Instant.now().plus(Duration.ofDays(400)))).isGreaterThanOrEqualTo(2);

        assertThat(mvc.post().uri("/api/auth/refresh").cookie(session.cookie()))
                .hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/auth/invites/" + invite)).hasStatus4xxClientError();
    }
}
