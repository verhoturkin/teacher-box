package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The H2 dump without the rows of the left-out tables (ADR-0037). */
class BackupDumpTest {

    private static final String LARGE = "x".repeat(100_000);

    @Test
    void leavesOutTheRowsAndLargeValuesOfATableButKeepsTheTable() throws SQLException {
        List<String> dump;
        try (Connection source = database()) {
            try (Statement sql = source.createStatement()) {
                sql.execute("""
                        create schema boards;
                        create table boards.boards (id int primary key, title varchar(100));
                        create table boards.board_backups (id int primary key,
                            board_id int references boards.boards (id), elements clob);
                        create table boards.board_backups_old (id int primary key, elements clob);
                        create table boards.notes (id int primary key, body clob);
                        insert into boards.boards values (1, 'Доска')""");
            }
            insert(source, "insert into boards.board_backups values (?, 1, ?)");
            insert(source, "insert into boards.board_backups_old values (?, ?)");
            insert(source, "insert into boards.notes values (?, ?)");
            dump = filtered(source, new BackupDump(List.of("boards.board_backups")));
        }

        assertThat(dump).noneMatch(row -> row.startsWith("INSERT INTO \"BOARDS\".\"BOARD_BACKUPS\" "));
        try (Connection target = database()) {
            try (Statement sql = target.createStatement()) {
                for (String row : dump) {
                    if (!row.startsWith("--")) {
                        sql.execute(row);
                    }
                }
            }
            assertThat(count(target, "boards.board_backups")).isZero();
            assertThat(count(target, "boards.boards")).isEqualTo(1);
            assertThat(count(target, "boards.board_backups_old")).isEqualTo(2);
            assertThat(count(target, "boards.notes")).isEqualTo(2);
            try (ResultSet note = target.createStatement()
                    .executeQuery("select body from boards.notes where id = 1")) {
                note.next();
                assertThat(note.getString(1)).isEqualTo(LARGE);
            }
        }
    }

    @Test
    void keepsEverythingWithoutLeftOutTables() {
        BackupDump dump = new BackupDump(List.of());

        assertThat(dump.keep("-- 3 +/- SELECT COUNT(*) FROM BOARDS.BOARD_BACKUPS;")).isTrue();
        assertThat(dump.keep("INSERT INTO SYSTEM_LOB_STREAM VALUES(0, 0, 'x', NULL);")).isTrue();
        assertThat(dump.keep("INSERT INTO \"BOARDS\".\"BOARD_BACKUPS\" VALUES\n(1);")).isTrue();
    }

    private static void insert(Connection connection, String sql) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(sql)) {
            for (int id = 0; id < 2; id++) {
                insert.setInt(1, id);
                insert.setString(2, id == 1 ? LARGE : "small");
                insert.execute();
            }
        }
    }

    private static List<String> filtered(Connection connection, BackupDump dump) throws SQLException {
        List<String> rows = new ArrayList<>();
        try (ResultSet script = connection.createStatement().executeQuery("SCRIPT")) {
            while (script.next()) {
                String row = script.getString(1);
                if (dump.keep(row)) {
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    private static int count(Connection connection, String table) throws SQLException {
        try (ResultSet rows = connection.createStatement().executeQuery("select count(*) from " + table)) {
            rows.next();
            return rows.getInt(1);
        }
    }

    private static Connection database() throws SQLException {
        return DriverManager.getConnection("jdbc:h2:mem:dump-" + UUID.randomUUID());
    }
}
