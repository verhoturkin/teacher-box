package ru.teacherbox.shared.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class ModuleMigrationsTest {

    private final DataSource dataSource =
            new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
    private final JdbcClient jdbc = JdbcClient.create(dataSource);

    @Test
    void migratesModuleIntoItsOwnSchemaWithOwnHistory() throws Exception {
        ModuleMigrations.initializer(dataSource, "sample").afterPropertiesSet();
        ModuleMigrations.initializer(dataSource, "other").afterPropertiesSet();

        jdbc.sql("insert into sample.note (id, text) values (1, 'hello')").update();
        assertThat(jdbc.sql("select text from sample.note").query(String.class).single()).isEqualTo("hello");
        assertThat(countTables("SAMPLE", "flyway_schema_history")).isEqualTo(1);
        assertThat(countTables("OTHER", "flyway_schema_history")).isEqualTo(1);
        assertThat(countTables("OTHER", "NOTE")).isZero();
    }

    @Test
    void migrationIsIdempotent() throws Exception {
        ModuleMigrations.initializer(dataSource, "sample").afterPropertiesSet();
        ModuleMigrations.initializer(dataSource, "sample").afterPropertiesSet();

        assertThat(countTables("SAMPLE", "NOTE")).isEqualTo(1);
    }

    @Test
    void rejectsInvalidModuleNames() {
        assertThatThrownBy(() -> ModuleMigrations.flyway(dataSource, "Bad-Name"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ModuleMigrations.flyway(dataSource, "x; drop"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void schemaNameIsUpperCase() {
        assertThat(ModuleMigrations.schemaName("billing")).isEqualTo("BILLING");
    }

    private int countTables(String schema, String table) {
        return jdbc.sql("select count(*) from information_schema.tables where table_schema = ? and table_name = ?")
                .params(schema, table)
                .query(Integer.class)
                .single();
    }
}
