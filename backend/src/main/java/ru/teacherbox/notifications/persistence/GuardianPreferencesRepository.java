package ru.teacherbox.notifications.persistence;

import java.time.Instant;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.GuardianCategory;
import ru.teacherbox.notifications.domain.GuardianPreferences;

@Repository
public class GuardianPreferencesRepository {

    private final JdbcClient jdbc;

    public GuardianPreferencesRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<GuardianPreferences> find(UUID guardianId) {
        return jdbc.sql("select off_categories from notifications.guardian_preferences where guardian_id = :id")
                .param("id", guardianId)
                .query((rs, rowNum) -> new GuardianPreferences(categories(rs.getString("off_categories"))))
                .optional();
    }

    public void save(UUID guardianId, GuardianPreferences preferences, Instant now) {
        jdbc.sql("""
                merge into notifications.guardian_preferences (guardian_id, off_categories, updated_at)
                key (guardian_id) values (:id, :off, :now)
                """)
                .param("id", guardianId)
                .param("off", preferences.off().stream().sorted().map(Enum::name).collect(Collectors.joining(",")))
                .param("now", now)
                .update();
    }

    private static EnumSet<GuardianCategory> categories(String value) {
        EnumSet<GuardianCategory> categories = EnumSet.noneOf(GuardianCategory.class);
        Arrays.stream(value.split(",")).filter(name -> !name.isBlank()).map(GuardianCategory::valueOf)
                .forEach(categories::add);
        return categories;
    }
}
