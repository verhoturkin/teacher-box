package ru.teacherbox.platform.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabase;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.persistence.ModuleMigrations;

/**
 * The address is the teacher's setting (ADR-0056); {@code TEACHERBOX_DOMAIN} gives only its default.
 */
class PortalAddressTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-27T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void theDomainIsTheDefaultAndTheTeachersAddressWins() {
        withRepository(repository -> {
            PortalService portal = new PortalService(repository, new PortalProperties(" School.Example.com "),
                    mock(FileStorage.class), CLOCK);

            assertThat(portal.address()).contains("https://school.example.com");
            assertThat(portal.view().address()).isEqualTo("https://school.example.com");

            PortalService.View view = portal.change("Школа", "http://localhost:8080", null);

            assertThat(view.address()).isEqualTo("http://localhost:8080");
            assertThat(portal.address()).contains("http://localhost:8080");
            assertThat(repository.load().updatedAt()).isEqualTo(CLOCK.instant());

            assertThat(portal.changeAddress(" ").address()).as("cleared: the default again")
                    .isEqualTo("https://school.example.com");
        });
    }

    @Test
    void noDomainMeansNoDefault() {
        assertThat(new PortalProperties("  ").defaultAddress()).isNull();
        assertThat(new PortalProperties(null).defaultAddress()).isNull();
        assertThat(new PortalProperties("not a host/path").defaultAddress()).isNull();
        assertThat(new PortalProperties("school.example.com").defaultAddress()).isEqualTo("https://school.example.com");
        withRepository(repository -> assertThat(new PortalService(repository, new PortalProperties(null),
                mock(FileStorage.class), CLOCK).address()).isEmpty());
    }

    @Test
    void aConcurrentChangeIsNotLost() {
        withRepository(repository -> {
            PortalSettings loaded = repository.load();
            repository.save(new PortalSettings("Первое", null, null, null, null, CLOCK.instant(), loaded.version()));

            assertThatThrownBy(() -> repository.save(new PortalSettings("Второе", null, null, null, null, CLOCK.instant(),
                    loaded.version())))
                    .isInstanceOf(OptimisticLockingFailureException.class);
            assertThat(repository.load().name()).isEqualTo("Первое");
        });
    }

    private static void withRepository(Consumer<PortalSettingsRepository> test) {
        EmbeddedDatabase database = new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2).generateUniqueName(true).build();
        try {
            ModuleMigrations.flyway(database, "platform").migrate();
            test.accept(new PortalSettingsRepository(JdbcClient.create(database)));
        } finally {
            database.shutdown();
        }
    }
}
