package ru.teacherbox.platform.settings;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;

/**
 * On start puts the settings the administrator saved before everything else, the environment
 * included (ADR-0016). They take the variable names, so {@code TEACHERBOX_AI_MODEL} is
 * {@code teacherbox.ai.model} just as the variable of the same name.
 */
public class AdminSettingsLoader implements ApplicationListener<ApplicationEnvironmentPreparedEvent>, Ordered {

    /**
     * Name of the property source with the administrator's settings; the suffix makes Spring Boot bind
     * the variable names to properties as it does for the environment.
     */
    public static final String SOURCE = "teacherboxAdminSettings-systemEnvironment";

    @Override
    public int getOrder() {
        // After the configuration files are read (EnvironmentPostProcessorApplicationListener, +10) and
        // before the logging system (LoggingApplicationListener, +20), so that the log settings apply too.
        return Ordered.HIGHEST_PRECEDENCE + 15;
    }

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        apply(event.getEnvironment());
    }

    static void apply(ConfigurableEnvironment environment) {
        Path dataDir = Path.of(environment.getProperty("teacherbox.data-dir", "./data"));
        Map<String, String> values = new SettingsFile(dataDir).read();
        if (!values.isEmpty()) {
            replace(environment, values);
        }
    }

    /**
     * Puts the values in force in the running portal (ADR-0056): what binds the properties on every call
     * sees them at once; without values the environment and the defaults apply again.
     */
    static void replace(ConfigurableEnvironment environment, Map<String, String> values) {
        if (values.isEmpty()) {
            environment.getPropertySources().remove(SOURCE);
            return;
        }
        SystemEnvironmentPropertySource source = new SystemEnvironmentPropertySource(SOURCE,
                new LinkedHashMap<>(values));
        if (environment.getPropertySources().contains(SOURCE)) {
            environment.getPropertySources().replace(SOURCE, source);
        } else {
            environment.getPropertySources().addFirst(source);
        }
    }
}
