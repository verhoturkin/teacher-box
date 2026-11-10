package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.ObjectProvider;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/** The teacher's old values are taken once (ADR-0056). */
class EnvImportTest {

    private static final String REMINDERS = "TEACHERBOX_SCHEDULE_REMINDERS";
    private static final String HORIZON = "TEACHERBOX_SCHEDULE_HORIZON";
    private static final String CURRENCY = "TEACHERBOX_BILLING_CURRENCY";

    @TempDir
    Path dataDir;

    private final Map<String, String> environment = new HashMap<>();
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void anUpgradedInstanceGetsTheValuesStillSetAndASecondStartIgnoresThem() {
        environment.put(REMINDERS, "2h");
        environment.put(CURRENCY, "EUR");
        Recording schedule = new Recording(Set.of(REMINDERS, HORIZON));
        Recording billing = new Recording(Set.of(CURRENCY));

        envImport(schedule, billing).afterPropertiesSet();

        assertThat(schedule.received).singleElement().satisfies(values -> {
            assertThat(values.text(REMINDERS)).contains("2h");
            assertThat(values.text(HORIZON)).isEmpty();
        });
        assertThat(billing.received).singleElement()
                .satisfies(values -> assertThat(values.text(CURRENCY)).contains("EUR"));
        assertThat(envImport().read()).containsOnlyKeys(REMINDERS, HORIZON, CURRENCY)
                .containsEntry(REMINDERS, "2026-11-09T10:00:00Z");

        environment.put(REMINDERS, "3h");
        environment.put(HORIZON, "28d");
        envImport(schedule, billing).run();

        assertThat(schedule.received).hasSize(1);
        assertThat(billing.received).hasSize(1);
    }

    @Test
    void theAdministratorsFileWinsAndAnEmptyValueIsPassedOn() {
        environment.put(REMINDERS, "2h");
        environment.put(HORIZON, "");
        new SettingsFile(dataDir).write(Map.of(REMINDERS, "45m"));
        Recording schedule = new Recording(Set.of(REMINDERS, HORIZON));

        envImport(schedule).run();

        assertThat(schedule.received).singleElement().satisfies(values -> {
            assertThat(values.text(REMINDERS)).contains("45m");
            assertThat(values.blank(HORIZON)).isTrue();
        });
    }

    @Test
    void aFailedModuleIsTriedAgainOnTheNextStart() {
        environment.put(CURRENCY, "EUR");
        TeacherSettingsImport failing = mock(TeacherSettingsImport.class);
        when(failing.names()).thenReturn(Set.of(CURRENCY));
        when(failing.importFrom(org.mockito.ArgumentMatchers.any())).thenThrow(new IllegalStateException("db"));

        envImport(failing).run();

        assertThat(envImport().read()).isEmpty();
        Recording billing = new Recording(Set.of(CURRENCY));
        envImport(billing).run();
        assertThat(billing.received).hasSize(1);
    }

    @Test
    void aVariableNoModuleTakesYetIsLeftForTheVersionThatDoes() {
        environment.put("TEACHERBOX_AI_MODEL", "claude");

        envImport().run();

        assertThat(envImport().read()).isEmpty();
        Recording ai = new Recording(Set.of("TEACHERBOX_AI_MODEL"));
        envImport(ai).run();
        assertThat(ai.received).singleElement()
                .satisfies(values -> assertThat(values.text("TEACHERBOX_AI_MODEL")).contains("claude"));
    }

    private EnvImport envImport(TeacherSettingsImport... modules) {
        @SuppressWarnings("unchecked")
        ObjectProvider<TeacherSettingsImport> provider = mock(ObjectProvider.class);
        when(provider.orderedStream()).thenAnswer(invocation -> Stream.of(modules));
        return new EnvImport(dataDir, new SettingsFile(dataDir), environment::get, provider, clock);
    }

    /** A module that stores everything it gets. */
    private static final class Recording implements TeacherSettingsImport {

        private final Set<String> names;
        private final List<OldSettings> received = new ArrayList<>();

        Recording(Set<String> names) {
            this.names = names;
        }

        @Override
        public Set<String> names() {
            return names;
        }

        @Override
        public Set<String> importFrom(OldSettings values) {
            received.add(values);
            return names;
        }
    }
}
