package ru.teacherbox.platform.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.testing.TestUsers;

/** The name and the address of the portal (ADR-0014). */
@SpringBootTest
@AutoConfigureMockMvc
class PortalIntegrationTest {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final UUID ADMIN = UUID.randomUUID();
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 0};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    Portal portal;

    private PortalSettingsRepository settings;

    @BeforeEach
    void repository(@Autowired JdbcClient jdbc) {
        settings = new PortalSettingsRepository(jdbc);
    }

    @AfterEach
    void backToDefaults() {
        assertThat(put("/api/teacher/portal", "{\"accent\":\"indigo\"}", TestUsers.teacher(TEACHER))).hasStatusOk();
        assertThat(mvc.delete().uri("/api/teacher/portal/logo").with(TestUsers.teacher(TEACHER))).hasStatusOk();
    }

    @Test
    void theTeacherChoosesTheColorOfThePortal() {
        assertThat(mvc.get().uri("/api/public/portal")).bodyJson().extractingPath("$.accent").isEqualTo("indigo");

        assertThat(put("/api/teacher/portal", "{\"name\":\"Школа\",\"accent\":\"Emerald\"}",
                TestUsers.teacher(TEACHER))).hasStatusOk().bodyJson().extractingPath("$.accent").isEqualTo("emerald");
        assertThat(put("/api/teacher/portal", "{\"name\":\"Школа\"}", TestUsers.teacher(TEACHER)))
                .as("no color: it stays").hasStatusOk().bodyJson().extractingPath("$.accent").isEqualTo("emerald");
        assertThat(mvc.get().uri("/api/public/portal")).bodyJson().extractingPath("$.accent").isEqualTo("emerald");
        assertThat(put("/api/teacher/portal", "{\"accent\":\"gold\"}", TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("portal.accent-invalid");
    }

    @Test
    void theTeacherUploadsAndRemovesTheLogo() {
        assertThat(mvc.get().uri("/api/public/portal/logo")).hasStatus(HttpStatus.NOT_FOUND);

        MvcTestResult png = upload(PNG, TestUsers.teacher(TEACHER));
        assertThat(png).hasStatusOk().bodyJson().extractingPath("$.logo").asString()
                .startsWith("/api/public/portal/logo?v=");
        assertThat(mvc.get().uri("/api/public/portal")).bodyJson().extractingPath("$.logo").isNotNull();
        assertThat(mvc.get().uri("/api/public/portal/logo")).hasStatusOk().hasContentType("image/png")
                .hasHeader("X-Content-Type-Options", "nosniff")
                .hasHeader("Cache-Control", "public, max-age=86400");

        byte[] svg = "\uFEFF<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>"
                .getBytes(StandardCharsets.UTF_8);
        assertThat(upload(svg, TestUsers.teacher(TEACHER))).hasStatusOk();
        assertThat(mvc.get().uri("/api/public/portal/logo")).hasStatusOk().hasContentType("image/svg+xml")
                .hasHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

        assertThat(mvc.delete().uri("/api/teacher/portal/logo").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().extractingPath("$.logo").isNull();
        assertThat(mvc.get().uri("/api/public/portal/logo")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void acceptsOnlySmallImagesFromTheTeacher() {
        assertThat(upload("<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8),
                TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("portal.logo-invalid");
        byte[] large = new byte[PortalService.MAX_LOGO_SIZE + 1];
        System.arraycopy(PNG, 0, large, 0, PNG.length);
        assertThat(upload(large, TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("portal.logo-too-large");
        assertThat(upload(PNG, TestUsers.student(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(upload(PNG, TestUsers.admin(ADMIN))).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void recognizesImagesByTheirFirstBytes() {
        assertThat(PortalService.LogoTypes.detect(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}))
                .contains("image/jpeg");
        assertThat(PortalService.LogoTypes.detect("RIFF0000WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)))
                .contains("image/webp");
        assertThat(PortalService.LogoTypes.detect("RIFF0000WAVE".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(PortalService.LogoTypes.detect("  <svg/>".getBytes(StandardCharsets.UTF_8)))
                .contains("image/svg+xml");
        assertThat(PortalService.LogoTypes.detect("<?xml version=\"1.0\"?><html/>".getBytes(StandardCharsets.UTF_8)))
                .isEmpty();
        assertThat(PortalService.LogoTypes.detect(new byte[] {(byte) 0x89})).isEmpty();
    }

    private MvcTestResult upload(byte[] content, RequestPostProcessor user) {
        MockMultipartFile file = new MockMultipartFile("file", "logo", "application/octet-stream", content);
        return mvc.perform(multipart(HttpMethod.PUT, "/api/teacher/portal/logo").file(file).with(user));
    }

    @Test
    void everyoneSeesTheDefaultName() {
        assertThat(mvc.get().uri("/api/public/portal")).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.name").isEqualTo("Teacher Box");
            assertThat(json).extractingPath("$.address").isNull();
        });
        assertThat(portal.address()).isEmpty();
        assertThat(portal.link("/cabinet")).isEmpty();
    }

    @Test
    void theTeacherNamesThePortalAndSetsItsAddress() {
        assertThat(put("/api/teacher/portal",
                "{\"name\":\"  Английский с Марией \",\"address\":\"https://School.Example.com/\"}",
                TestUsers.teacher(TEACHER)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.name").isEqualTo("Английский с Марией");
                    assertThat(json).extractingPath("$.address").isEqualTo("https://school.example.com");
                    assertThat(json).extractingPath("$.addressFromEnvironment").isEqualTo(false);
                });

        assertThat(portal.name()).isEqualTo("Английский с Марией");
        assertThat(portal.link("/cabinet/billing")).contains("https://school.example.com/cabinet/billing");
        assertThat(mvc.get().uri("/api/public/portal")).hasStatusOk().bodyJson()
                .extractingPath("$.address").isEqualTo("https://school.example.com");
        assertThat(mvc.get().uri("/api/teacher/portal").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().extractingPath("$.name").isEqualTo("Английский с Марией");
    }

    @Test
    void theFirstSetupIsCompletedOnce() {
        assertThat(mvc.get().uri("/api/teacher/portal").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().extractingPath("$.setupCompleted").isEqualTo(false);

        assertThat(mvc.post().uri("/api/teacher/portal/setup").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().extractingPath("$.setupCompleted").isEqualTo(true);
        Instant completedAt = settings.load().setupCompletedAt();
        assertThat(mvc.post().uri("/api/teacher/portal/setup").with(TestUsers.teacher(TEACHER))).hasStatusOk();
        assertThat(settings.load().setupCompletedAt()).isEqualTo(completedAt);
        assertThat(put("/api/teacher/portal", "{\"name\":\"Школа\"}", TestUsers.teacher(TEACHER)))
                .hasStatusOk().bodyJson().extractingPath("$.setupCompleted").isEqualTo(true);
        assertThat(mvc.get().uri("/api/public/portal")).bodyJson().doesNotHavePath("$.setupCompleted");
        assertThat(mvc.post().uri("/api/teacher/portal/setup").with(TestUsers.admin(ADMIN)))
                .hasStatus(HttpStatus.FORBIDDEN);

        PortalSettings current = settings.load();
        settings.save(new PortalSettings(current.name(), current.address(), current.accent(), current.logo(), null,
                current.updatedAt(),
                current.version()));
    }

    @Test
    void rejectsAddressesWithAPathAndTooLongNames() {
        assertThat(put("/api/teacher/portal", "{\"address\":\"https://school.example.com/portal\"}",
                TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("portal.address-invalid");
        assertThat(put("/api/teacher/portal", "{\"name\":\"" + "я".repeat(61) + "\"}", TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(portal.address()).isEmpty();
    }

    @Test
    void theAdministratorChangesOnlyTheAddress() {
        put("/api/teacher/portal", "{\"name\":\"Школа\"}", TestUsers.teacher(TEACHER));

        assertThat(mvc.get().uri("/api/admin/portal").with(TestUsers.admin(ADMIN))).hasStatusOk()
                .bodyJson().extractingPath("$.name").isEqualTo("Школа");
        assertThat(put("/api/admin/portal", "{\"address\":\"http://192.168.1.10:8080\",\"name\":\"Другое\"}",
                TestUsers.admin(ADMIN)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.name").isEqualTo("Школа");
                    assertThat(json).extractingPath("$.address").isEqualTo("http://192.168.1.10:8080");
                });
        assertThat(put("/api/admin/portal", "{\"address\":\"\"}", TestUsers.admin(ADMIN))).hasStatusOk()
                .bodyJson().extractingPath("$.address").isNull();
        assertThat(portal.name()).isEqualTo("Школа");
    }

    @Test
    void onlyTheTeacherAndTheAdministratorChangeIt() {
        assertThat(put("/api/teacher/portal", "{\"name\":\"Моё\"}", TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(put("/api/teacher/portal", "{\"name\":\"Моё\"}", TestUsers.admin(ADMIN)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(put("/api/admin/portal", "{\"address\":\"https://evil.example\"}", TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/portal")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(portal.name()).isEqualTo(Portal.DEFAULT_NAME);
    }

    private MvcTestResult put(String uri, String body, RequestPostProcessor user) {
        return mvc.put().uri(uri).with(user).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}
