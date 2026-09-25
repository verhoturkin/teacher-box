package ru.teacherbox.shared.persistence;

import java.util.Locale;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;

/**
 * Per-module database migrations: every module owns a separate schema (named after the module)
 * with its own Flyway history table and migration scripts in {@code classpath:db/migration/<module>}.
 *
 * <p>Usage in a module configuration:
 * <pre>{@code
 * @Bean
 * FlywayMigrationInitializer billingMigrations(DataSource dataSource) {
 *     return ModuleMigrations.initializer(dataSource, "billing");
 * }
 * }</pre>
 * Spring Boot detects {@link FlywayMigrationInitializer} beans, so JDBC beans are initialized after migrations.
 */
public final class ModuleMigrations {

    private static final Pattern MODULE_NAME = Pattern.compile("[a-z][a-z0-9]*");

    private ModuleMigrations() {
    }

    public static FlywayMigrationInitializer initializer(DataSource dataSource, String module) {
        return new FlywayMigrationInitializer(flyway(dataSource, module));
    }

    public static Flyway flyway(DataSource dataSource, String module) {
        if (!MODULE_NAME.matcher(module).matches()) {
            throw new IllegalArgumentException("Invalid module name: " + module);
        }
        String schema = schemaName(module);
        return Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(true)
                .table("flyway_schema_history")
                .locations("classpath:db/migration/" + module)
                .load();
    }

    /** Database schema of a module. Unquoted identifiers in H2 are upper case. */
    public static String schemaName(String module) {
        return module.toUpperCase(Locale.ROOT);
    }
}
