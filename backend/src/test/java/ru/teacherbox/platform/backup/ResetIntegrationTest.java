package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.reset.DataReset;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.testing.TestUsers;

/** The full reset of the portal (ADR-0014) on the whole application. */
@SpringBootTest
@AutoConfigureMockMvc
class ResetIntegrationTest {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final List<String> SCHEMAS = List.of("IDENTITY", "BILLING", "HOMEWORK", "NOTIFICATIONS", "AI",
            "SCHEDULE", "MEETINGS", "BOARDS", "PLATFORM");

    @Autowired
    MockMvcTester mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    List<DataReset> resets;

    @Autowired
    BackupService backups;

    @Autowired
    Portal portal;

    @Autowired
    PlatformProperties platform;

    @MockitoBean
    PasswordConfirmation passwords;

    @BeforeEach
    void passwords() {
        when(passwords.matches(any(), anyString())).thenReturn(false);
        when(passwords.matches(TEACHER, "teacher-password")).thenReturn(true);
    }

    @Test
    void everyTableOfEveryModuleIsCleared() {
        Set<String> declared = new TreeSet<>();
        resets.forEach(reset -> declared.addAll(reset.tables()));
        Set<String> existing = new TreeSet<>(jdbc.sql("""
                select lower(table_schema) || '.' || lower(table_name) from information_schema.tables
                where table_schema in (:schemas) and table_name <> 'flyway_schema_history'
                """).param("schemas", SCHEMAS).query(String.class).list());

        assertThat(declared).as("a new table must be cleared by the reset of its module").isEqualTo(existing);
    }

    @Test
    void deletesEverythingButTheAccountsAfterABackup() throws IOException {
        UUID student = student("Сбрасываемый");
        waitFor(() -> count("billing.student_accounts") > 0 && incompleteEvents() == 0);
        assertThat(post("/api/teacher/boards", "{\"kind\":\"EXCALIDRAW\",\"title\":\"Доска\",\"studentIds\":[\""
                + student + "\"]}")).hasStatus(HttpStatus.CREATED);
        assertThat(post("/api/teacher/billing/payments", "{\"studentId\":\"" + student
                + "\",\"amount\":150000,\"paidOn\":\"" + LocalDate.now() + "\"}"))
                .hasStatus(HttpStatus.CREATED);
        assertThat(post("/api/teacher/schedule/lessons", "{\"studentId\":\"" + student + "\",\"startsAt\":\""
                + Instant.now().plus(Duration.ofDays(3)) + "\"}")).hasStatus(HttpStatus.CREATED);
        assertThat(mvc.put().uri("/api/teacher/portal").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Школа\",\"address\":\"https://school.example.com\"}")).hasStatusOk();
        assertThat(mvc.post().uri("/api/teacher/portal/setup").with(teacher())).hasStatusOk();
        assertThat(mvc.put().uri("/api/teacher/billing/default-price").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("{\"lessonPrice\":200000}")).hasStatusOk();
        Path file = platform.dataDir().resolve("files/homework/ab/material.txt");
        Files.createDirectories(file.getParent());
        Files.writeString(file, "условие");
        waitFor(() -> incompleteEvents() == 0);
        assertThat(count("identity.users")).isGreaterThan(1);
        assertThat(count("boards.boards") + count("billing.payments") + count("schedule.lessons")).isEqualTo(3);

        assertThat(post("/api/teacher/reset", "{\"password\":\"wrong\"}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.wrong-current");
        assertThat(count("boards.boards")).isEqualTo(1);

        MvcTestResult reset = post("/api/teacher/reset", "{\"password\":\"teacher-password\"}");

        assertThat(reset).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.backup").asString().startsWith("teacherbox-");
            assertThat(json).extractingPath("$.hints").asArray().isEmpty();
        });
        for (DataReset module : resets) {
            for (String table : module.tables()) {
                long left = count(table);
                switch (table) {
                    case "identity.users", "identity.refresh_tokens" -> assertThat(jdbc.sql(
                            "select count(*) from identity.users where role = 'STUDENT'").query(Long.class).single())
                            .as("students and their sessions").isZero();
                    case "billing.settings", "platform.portal_settings" -> assertThat(left).as(table).isEqualTo(1);
                    default -> assertThat(left).as(table).isZero();
                }
            }
        }
        assertThat(jdbc.sql("select count(*) from identity.users where role = 'TEACHER'").query(Long.class).single())
                .isEqualTo(1);
        assertThat(jdbc.sql("select default_lesson_price from billing.settings").query(Long.class).optional())
                .isEmpty();
        assertThat(portal.name()).isEqualTo(Portal.DEFAULT_NAME);
        assertThat(portal.address()).isEmpty();
        assertThat(mvc.get().uri("/api/teacher/portal").with(teacher())).bodyJson()
                .extractingPath("$.setupCompleted").isEqualTo(false);
        assertThat(file).doesNotExist();
        assertThat(platform.dataDir().resolve("files")).isDirectory();
        assertThat(incompleteEvents()).isZero();
        assertThat(backups.list().getFirst().kind()).isEqualTo(BackupKind.BEFORE_RESET);
        assertThat(backups.list().getFirst().name()).isEqualTo(
                JsonPath.read(reset.getResponse().getContentAsString(), "$.backup"));
    }

    @Test
    void onlyTheTeacherResets() {
        assertThat(mvc.post().uri("/api/teacher/reset").with(TestUsers.student(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"x\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/reset").with(TestUsers.admin(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"x\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(post("/api/teacher/reset", "{}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    private UUID student(String name) {
        MvcTestResult created = post("/api/teacher/students", "{\"displayName\":\"" + name + "\"}");
        assertThat(created).hasStatus(HttpStatus.CREATED);
        try {
            return UUID.fromString(JsonPath.read(created.getResponse().getContentAsString(), "$.student.id"));
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(TEACHER);
    }

    private long count(String table) {
        return jdbc.sql("select count(*) from " + table).query(Long.class).single();
    }

    private long incompleteEvents() {
        return jdbc.sql("select count(*) from event_publication where completion_date is null")
                .query(Long.class).single();
    }

    private static void waitFor(BooleanSupplier condition) {
        long deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() > deadline) {
                throw new AssertionError("Timed out");
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AssertionError(e);
            }
        }
    }
}
