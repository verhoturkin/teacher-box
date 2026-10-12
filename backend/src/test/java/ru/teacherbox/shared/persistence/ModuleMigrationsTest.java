package ru.teacherbox.shared.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class ModuleMigrationsTest {

    private final String url = "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
    /** Like a pool that has replaced its connections: every statement gets a new one and closes it. */
    private final DataSource dataSource = new DriverManagerDataSource(url, "sa", "");
    private final JdbcClient jdbc = JdbcClient.create(dataSource);
    private final MigrationConnection connection = new MigrationConnection(url, "sa", "");

    @AfterEach
    void closeConnection() {
        connection.close();
    }

    @Test
    void migratesModuleIntoItsOwnSchemaWithOwnHistory() throws Exception {
        ModuleMigrations.initializer(connection, "sample").afterPropertiesSet();
        ModuleMigrations.initializer(connection, "other").afterPropertiesSet();

        jdbc.sql("insert into sample.note (id, text) values (1, 'hello')").update();
        assertThat(jdbc.sql("select text from sample.note").query(String.class).single()).isEqualTo("hello");
        assertThat(countTables("SAMPLE", "flyway_schema_history")).isEqualTo(1);
        assertThat(countTables("OTHER", "flyway_schema_history")).isEqualTo(1);
        assertThat(countTables("OTHER", "NOTE")).isZero();
    }

    @Test
    void migrationIsIdempotent() throws Exception {
        ModuleMigrations.initializer(connection, "sample").afterPropertiesSet();
        ModuleMigrations.initializer(connection, "sample").afterPropertiesSet();

        assertThat(countTables("SAMPLE", "NOTE")).isEqualTo(1);
    }

    /** H2 compiles {@code in (...)} of a constraint against the session that altered the table. */
    @Test
    void constraintAlteredByMigrationWorksAfterOtherConnectionsClose() throws Exception {
        ModuleMigrations.initializer(connection, "altered").afterPropertiesSet();

        jdbc.sql("insert into altered.item (id, status) values (1, 'NEW')").update();
        jdbc.sql("update altered.item set status = 'DONE', note = 'ok' where id = 1").update();

        assertThat(jdbc.sql("select status from altered.item").query(String.class).single()).isEqualTo("DONE");
        assertThatThrownBy(() -> jdbc.sql("update altered.item set status = 'LOST'").update())
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("CK_ITEM_STATUS");
    }

    @Test
    void closingReleasesTheConnection() throws Exception {
        Connection opened = connection.dataSource().getConnection();
        opened.close();
        assertThat(opened.unwrap(Connection.class).isClosed()).isFalse();

        connection.close();

        assertThat(opened.unwrap(Connection.class).isClosed()).isTrue();
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
