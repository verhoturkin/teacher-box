package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import ru.teacherbox.platform.settings.SettingDefinition.Access;

/** The catalog of the administrator's settings follows {@code .env.example} (ADR-0016). */
class SettingsCatalogTest {

    private static final Pattern VARIABLE = Pattern.compile("^#?\\s*([A-Z][A-Z0-9_]+)=", Pattern.MULTILINE);

    @Test
    void hasEveryVariableOfTheExampleAndNothingElse() throws IOException {
        String example = Files.readString(Path.of("..", ".env.example"));
        Matcher matcher = VARIABLE.matcher(example);
        List<String> variables = matcher.results().map(result -> result.group(1)).toList();

        assertThat(SettingsCatalog.all()).extracting(SettingDefinition::name)
                .doesNotHaveDuplicates()
                .containsExactlyInAnyOrderElementsOf(variables);
    }

    @Test
    void secretsAreNeverShownAndAccountsAreNotChangedHere() {
        assertThat(SettingsCatalog.all())
                .filteredOn(setting -> setting.name().matches(".*(PASSWORD|TOKEN|SECRET|API_KEY)$")
                        && !setting.name().endsWith("_RESET_PASSWORD"))
                .isNotEmpty()
                .allMatch(SettingDefinition::secret);
        assertThat(SettingsCatalog.all())
                .filteredOn(setting -> setting.name().startsWith("TEACHERBOX_IDENTITY_TEACHER_"))
                .allMatch(setting -> setting.access() == Access.ACCOUNT);
        assertThat(SettingsCatalog.find("TEACHERBOX_HTTP_PORT")).get()
                .extracting(SettingDefinition::access).isEqualTo(Access.DOCKER);
        assertThat(SettingsCatalog.find("TEACHERBOX_AI_MODEL")).get().matches(SettingDefinition::editable);
        assertThat(SettingsCatalog.find("NOPE")).isEmpty();
        // one key per section, and a key never names two sections
        assertThat(SettingsCatalog.all().stream().map(setting -> setting.section() + "=" + setting.group()).distinct())
                .doesNotHaveDuplicates()
                .hasSameSizeAs(SettingsCatalog.all().stream().map(SettingDefinition::section).distinct().toList());
        assertThat(SettingsCatalog.all()).allSatisfy(setting -> {
            assertThat(setting.title()).isNotBlank();
            assertThat(setting.group()).isNotBlank();
            assertThat(setting.section()).matches("[a-z]+");
            assertThat(setting.kind() == SettingKind.CHOICE).isEqualTo(!setting.choices().isEmpty());
        });
    }
}
