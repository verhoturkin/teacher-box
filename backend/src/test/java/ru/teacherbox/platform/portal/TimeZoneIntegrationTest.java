package ru.teacherbox.platform.portal;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.scheduling.config.TriggerTask;
import org.springframework.scheduling.support.SimpleTriggerContext;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.shared.settings.SettingsChanged;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.testing.TestUsers;

/** The teacher's time zone in the database, in force without a restart (ADR-0056). */
@SpringBootTest(properties = "teacherbox.scheduling.enabled=true")
@AutoConfigureMockMvc
@RecordApplicationEvents
class TimeZoneIntegrationTest {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final String PATH = "/api/teacher/settings/time-zone";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    InstanceTimeZone timeZone;

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void backToTheDefault() {
        jdbc.sql("update platform.portal_settings set time_zone = null").update();
    }

    @Test
    void onlyTheTeacherChangesTheTimeZone() {
        assertThat(put("{\"timeZone\":\"Asia/Yekaterinburg\"}", TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(put("{\"timeZone\":\"Asia/Yekaterinburg\"}", TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri(PATH).contentType(MediaType.APPLICATION_JSON)
                .content("{\"timeZone\":\"Asia/Yekaterinburg\"}")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(timeZone.zoneId()).isEqualTo(PortalTimeZone.DEFAULT);
    }

    @Test
    void theNewZoneIsInForceAtOnce(ApplicationEvents events) {
        Instant stored = Instant.parse("2026-09-01T20:30:00Z");
        Clock evening = Clock.fixed(stored, ZoneOffset.UTC);
        assertThat(timeZone.today(evening)).isEqualTo(LocalDate.parse("2026-09-01"));

        assertThat(put("{\"timeZone\":\" Asia/Yekaterinburg \"}", TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().extractingPath("$.timeZone").isEqualTo("Asia/Yekaterinburg");

        assertThat(timeZone.zoneId()).isEqualTo(ZoneId.of("Asia/Yekaterinburg"));
        assertThat(timeZone.today(evening)).as("the same instant, a later date").isEqualTo(LocalDate.parse("2026-09-02"));
        assertThat(jdbc.sql("select time_zone from platform.portal_settings").query(String.class).single())
                .isEqualTo("Asia/Yekaterinburg");
        assertThat(events.stream(SettingsChanged.class))
                .anySatisfy(event -> assertThat(event.names()).containsExactly(InstanceTimeZone.SETTING));
        assertThat(mvc.get().uri("/api/me/schedule/settings").with(TestUsers.teacher(TEACHER)))
                .as("the modules read it per call").hasStatusOk()
                .bodyJson().extractingPath("$.timeZone").isEqualTo("Asia/Yekaterinburg");
    }

    @Test
    void theNightlyJobsFireByTheNewZone(@Autowired ScheduledTaskHolder holder) {
        Trigger backup = holder.getScheduledTasks().stream().map(ScheduledTask::getTask)
                .filter(TriggerTask.class::isInstance).map(task -> ((TriggerTask) task).getTrigger())
                .filter(trigger -> trigger.toString().startsWith("backup ")).findFirst().orElseThrow();
        assertThat(holder.getScheduledTasks()).extracting(task -> task.getTask().toString()).isNotEmpty();
        SimpleTriggerContext noon = new SimpleTriggerContext(Clock.fixed(Instant.parse("2026-09-01T12:00:00Z"),
                ZoneOffset.UTC));
        assertThat(backup.nextExecution(noon)).as("03:30 in Moscow").isEqualTo(Instant.parse("2026-09-02T00:30:00Z"));

        assertThat(put("{\"timeZone\":\"Asia/Yekaterinburg\"}", TestUsers.teacher(TEACHER))).hasStatusOk();

        assertThat(backup.nextExecution(noon)).as("03:30 in Yekaterinburg")
                .isEqualTo(Instant.parse("2026-09-01T22:30:00Z"));
    }

    @Test
    void refusesWhatIsNotARegion() {
        for (String wrong : new String[] {"Mars/Olympus", "+03:00", "GMT+3", "europe/moscow"}) {
            assertThat(put("{\"timeZone\":\"" + wrong + "\"}", TestUsers.teacher(TEACHER))).as(wrong)
                    .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                    .bodyJson().extractingPath("$.code").isEqualTo("portal.time-zone-invalid");
        }
        assertThat(put("{\"timeZone\":\" \"}", TestUsers.teacher(TEACHER))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(timeZone.zoneId()).isEqualTo(PortalTimeZone.DEFAULT);
    }

    @Test
    void aBrokenStoredValueGivesTheDefault() {
        jdbc.sql("update platform.portal_settings set time_zone = 'Nowhere'").update();
        assertThat(timeZone.zoneId()).isEqualTo(PortalTimeZone.DEFAULT);
    }

    private MvcTestResult put(String body, RequestPostProcessor user) {
        return mvc.put().uri(PATH).with(user).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}
