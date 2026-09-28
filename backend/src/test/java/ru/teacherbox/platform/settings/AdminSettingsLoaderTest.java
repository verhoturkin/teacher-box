package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;

class AdminSettingsLoaderTest {

    @TempDir
    Path dataDir;

    private StandardEnvironment environment(Map<String, Object> variables) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().replace(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                new SystemEnvironmentPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                        variables));
        environment.getPropertySources().addLast(new MapPropertySource("config",
                Map.of("teacherbox.data-dir", dataDir.toString())));
        return environment;
    }

    @Test
    void theAdministratorsValuesComeBeforeTheEnvironment() {
        new SettingsFile(dataDir).write(Map.of(
                "TEACHERBOX_AI_MODEL", "from-admin",
                "TEACHERBOX_IDENTITY_TEACHER_PASSWORD", "never-applied",
                "SOMETHING_ELSE", "ignored",
                "TEACHERBOX_IDENTITY_LOCK_DURATION", "30m"));
        StandardEnvironment environment = environment(Map.of(
                "TEACHERBOX_AI_MODEL", "from-env",
                "TEACHERBOX_IDENTITY_TEACHER_PASSWORD", "from-env-password"));

        AdminSettingsLoader.apply(environment);

        assertThat(environment.getProperty("teacherbox.ai.model")).isEqualTo("from-admin");
        assertThat(Binder.get(environment).bind("teacherbox.identity.lock-duration", Duration.class).get())
                .isEqualTo(Duration.ofMinutes(30));
        assertThat(environment.getProperty("teacherbox.identity.teacher.password")).isEqualTo("from-env-password");
        assertThat(environment.getProperty("something.else")).isNull();
        assertThat(new AdminSettingsLoader().getOrder()).isLessThan(0);
    }

    @Test
    void withoutAFileNothingChanges() {
        StandardEnvironment environment = environment(Map.of("TEACHERBOX_AI_MODEL", "from-env"));
        int sources = environment.getPropertySources().size();

        AdminSettingsLoader.apply(environment);

        assertThat(environment.getPropertySources().size()).isEqualTo(sources);
        assertThat(environment.getProperty("teacherbox.ai.model")).isEqualTo("from-env");
    }
}
