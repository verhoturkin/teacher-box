package ru.teacherbox.meetings.application;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/** Full reset (ADR-0014): the rooms and the connection of Yandex (its token is revoked). */
@Component
class MeetingsDataReset implements DataReset {

    private static final List<String> TABLES = List.of("meetings.rooms", "meetings.yandex_connection",
            "meetings.yandex_oauth_states");

    private final JdbcClient jdbc;
    private final YandexService yandex;
    private Runnable revocation = () -> {
    };

    MeetingsDataReset(JdbcClient jdbc, YandexService yandex) {
        this.jdbc = jdbc;
        this.yandex = yandex;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        revocation = yandex.revocationForReset();
        for (String table : TABLES) {
            jdbc.sql("delete from " + table).update();
        }
    }

    @Override
    public Optional<String> afterErase() {
        Runnable revoke = revocation;
        revocation = () -> {
        };
        revoke.run();
        return Optional.empty();
    }
}
