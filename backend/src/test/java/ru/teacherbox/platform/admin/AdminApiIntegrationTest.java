package ru.teacherbox.platform.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.platform.web.RequestIdFilter;
import ru.teacherbox.testing.TestUsers;

/** The administrator's API on the whole application (ADR-0010). */
@SpringBootTest(properties = "teacherbox.ai.api-key=super-secret-key")
@AutoConfigureMockMvc
class AdminApiIntegrationTest {

    private static final UUID ADMIN = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Test
    void onlyTheAdministratorSeesTheState() {
        assertThat(mvc.get().uri("/api/admin/status").with(admin()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.javaVersion").asString().isNotBlank();
                    assertThat(json).extractingPath("$.timeZone").isEqualTo("Europe/Moscow");
                    assertThat(json).extractingPath("$.heapMax").asNumber().isNotEqualTo(0);
                    assertThat(json).extractingPath("$.components.db").isEqualTo("UP");
                });
        assertThat(mvc.get().uri("/api/admin/status").with(TestUsers.teacher(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/admin/status")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void changesALogLevelForAWhile() {
        assertThat(mvc.get().uri("/api/admin/loggers").with(admin()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[*].name").asArray().contains("ROOT", "ru.teacherbox");

        assertThat(mvc.put().uri("/api/admin/loggers/ru.teacherbox.test.admin").with(admin())
                .contentType(MediaType.APPLICATION_JSON).content("{\"level\":\"DEBUG\",\"minutes\":5}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.configuredLevel").isEqualTo("DEBUG");
                    assertThat(json).extractingPath("$.revertAt").isNotNull();
                });
        assertThat(mvc.delete().uri("/api/admin/loggers/ru.teacherbox.test.admin").with(admin()))
                .hasStatusOk()
                .bodyJson().extractingPath("$.configuredLevel").isNull();

        assertThat(mvc.put().uri("/api/admin/loggers/ru.teacherbox.test.admin").with(admin())
                .contentType(MediaType.APPLICATION_JSON).content("{\"level\":\"DEBUG\",\"minutes\":0}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.put().uri("/api/admin/loggers/bad-name!").with(admin())
                .contentType(MediaType.APPLICATION_JSON).content("{\"level\":\"DEBUG\",\"minutes\":5}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("admin.logger-invalid");
    }

    @Test
    void searchesTheLog() {
        assertThat(mvc.get().uri("/api/admin/logs?level=WARN&text=boom&limit=10").with(admin()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.available").isEqualTo(false);
                    assertThat(json).extractingPath("$.entries").asArray().isEmpty();
                });
    }

    @Test
    void showsAndResubmitsPendingEvents() {
        assertThat(mvc.get().uri("/api/admin/events").with(admin())).hasStatusOk();
        assertThat(mvc.post().uri("/api/admin/events/resubmit").with(admin())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.resubmitted").asNumber().isNotNull();
        assertThat(mvc.post().uri("/api/admin/events/resubmit").with(admin())
                .contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"%s\"]}".formatted(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.resubmitted").isEqualTo(0);
    }

    @Test
    void checksTheIntegrationsOfTheModules() {
        assertThat(mvc.post().uri("/api/admin/integrations/check").with(admin()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[*].name").asArray()
                            .contains("Telegram", "ВКонтакте", "MAX", "ИИ", "Google Календарь");
                    assertThat(json).extractingPath("$[?(@.name == 'ИИ')].state").asArray()
                            .containsExactly("NOT_CONFIGURED");
                });
    }

    @Test
    void preparesADiagnosticArchiveWithoutSecrets() throws IOException {
        MvcTestResult result = mvc.get().uri("/api/admin/diagnostics").with(admin()).exchange();

        assertThat(result).hasStatusOk().hasContentType("application/zip");
        assertThat(result.getResponse().getHeader("Content-Disposition"))
                .startsWith("attachment; filename=\"teacher-box-diagnostics-");
        Map<String, String> entries = unzip(result.getResponse().getContentAsByteArray());
        assertThat(entries).containsKeys("status.json", "settings.txt");
        assertThat(entries.get("settings.txt")).contains("teacherbox.ai.api-key=***")
                .doesNotContain("super-secret-key");
        assertThat(entries.get("status.json")).contains("\"javaVersion\"");
    }

    @Test
    void everyResponseCarriesTheRequestCode() {
        MvcTestResult generated = mvc.get().uri("/api/admin/nothing-here").with(admin()).exchange();
        String code = generated.getResponse().getHeader(RequestIdFilter.HEADER);
        assertThat(code).matches("[a-z2-9]{10}");
        assertThat(generated).bodyJson().extractingPath("$.requestId").isEqualTo(code);

        assertThat(mvc.get().uri("/api/admin/status").header(RequestIdFilter.HEADER, "proxy-42"))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .hasHeader(RequestIdFilter.HEADER, "proxy-42")
                .bodyJson().extractingPath("$.requestId").isEqualTo("proxy-42");
        assertThat(mvc.get().uri("/api/admin/status").with(admin()).header(RequestIdFilter.HEADER, "bad id!")
                .exchange().getResponse().getHeader(RequestIdFilter.HEADER)).isNotEqualTo("bad id!");
    }

    @Test
    void browserErrorsAreLoggedWithALimit() {
        RequestPostProcessor from = request -> {
            request.setRemoteAddr("10.0.0.7");
            return request;
        };
        String error = "{\"message\":\"TypeError: x is undefined\",\"url\":\"/teacher\",\"stack\":\"at main.js:1\"}";

        assertThat(mvc.post().uri("/api/client-errors").with(from).contentType(MediaType.APPLICATION_JSON)
                .content(error)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.post().uri("/api/client-errors").with(from).with(TestUsers.student(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"no stack\"}"))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.post().uri("/api/client-errors").with(from).contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\" \"}")).hasStatus(HttpStatus.BAD_REQUEST);
        for (int i = 0; i < 10; i++) {
            mvc.post().uri("/api/client-errors").with(from).contentType(MediaType.APPLICATION_JSON).content(error)
                    .exchange();
        }
        assertThat(mvc.post().uri("/api/client-errors").with(from).contentType(MediaType.APPLICATION_JSON)
                .content(error)).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
    }

    private static RequestPostProcessor admin() {
        return TestUsers.admin(ADMIN);
    }

    private static Map<String, String> unzip(byte[] archive) throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive))) {
            for (ZipEntry entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return entries;
    }
}
