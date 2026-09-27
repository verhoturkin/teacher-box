package ru.teacherbox.platform.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import ru.teacherbox.shared.persistence.ModuleMigrations;

/** {@code TEACHERBOX_PUBLIC_URL} takes precedence over the address entered in the interface. */
class PortalFromEnvironmentTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-27T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void theVariableWins() {
        withRepository(repository -> {
            PortalService portal = new PortalService(repository, new PortalProperties("https://school.example.com/"),
                    CLOCK);

            PortalService.View view = portal.change("Школа", "http://localhost:8080");

            assertThat(view.address()).isEqualTo("https://school.example.com");
            assertThat(view.addressFromEnvironment()).isTrue();
            assertThat(portal.address()).contains("https://school.example.com");
            assertThat(repository.load().address()).as("kept for the day the variable is removed")
                    .isEqualTo("http://localhost:8080");
            assertThat(repository.load().updatedAt()).isEqualTo(CLOCK.instant());
        });
    }

    @Test
    void anEmptyVariableMeansNoAddress() {
        assertThat(new PortalProperties("  ").address()).isNull();
        assertThat(new PortalProperties(null).address()).isNull();
        assertThatThrownBy(() -> new PortalProperties("https://school.example.com/portal"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TEACHERBOX_PUBLIC_URL");
    }

    @Test
    void aConcurrentChangeIsNotLost() {
        withRepository(repository -> {
            PortalSettings loaded = repository.load();
            repository.save(new PortalSettings("Первое", null, null, CLOCK.instant(), loaded.version()));

            assertThatThrownBy(() -> repository.save(new PortalSettings("Второе", null, null, CLOCK.instant(),
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
