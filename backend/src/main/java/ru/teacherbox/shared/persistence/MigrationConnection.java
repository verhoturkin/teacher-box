package ru.teacherbox.shared.persistence;

import javax.sql.DataSource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/**
 * The one database connection the migrations of all modules run on: outside the pool and open until the
 * application stops.
 *
 * <p>H2 compiles a {@code check (x in (...))} constraint against the session that ran its {@code create} or
 * {@code alter table}; once that session is closed, every check of the constraint fails with «Check constraint
 * invalid … The database has been closed». A pooled connection is closed by the pool sooner or later (max
 * lifetime), this one is not. After a restart the database compiles its constraints with its own session.
 */
public final class MigrationConnection implements AutoCloseable {

    private final SingleConnectionDataSource dataSource;

    public MigrationConnection(String url, String username, String password) {
        this.dataSource = new SingleConnectionDataSource(url, username, password, true);
    }

    DataSource dataSource() {
        return dataSource;
    }

    @Override
    public void close() {
        dataSource.destroy();
    }
}
