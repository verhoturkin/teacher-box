package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import ru.teacherbox.platform.settings.SettingDefinition.Access;
import ru.teacherbox.platform.settings.SettingDefinition.Owner;
import ru.teacherbox.shared.i18n.Language;

/**
 * The catalog of the settings follows {@code .env.example} (ADR-0016), but for the teacher's settings,
 * which live in the portal (ADR-0056).
 */
class SettingsCatalogTest {

    private static final Pattern VARIABLE = Pattern.compile("^#?\\s*([A-Z][A-Z0-9_]+)=", Pattern.MULTILINE);

    @Test
    void hasEveryVariableOfTheExampleAndNothingElse() throws IOException {
        String example = Files.readString(Path.of("..", ".env.example"));
        Matcher matcher = VARIABLE.matcher(example);
        List<String> variables = matcher.results().map(result -> result.group(1)).toList();

        assertThat(SettingsCatalog.all()).extracting(SettingDefinition::name).doesNotHaveDuplicates();
        assertThat(SettingsCatalog.all()).filteredOn(setting -> setting.owner() != Owner.TEACHER)
                .extracting(SettingDefinition::name)
                .containsExactlyInAnyOrderElementsOf(variables);
    }

    @Test
    void theTeachersAndTheLiveSettingsAreInTheCatalog() {
        assertThat(SettingsCatalog.all()).filteredOn(setting -> setting.owner() == Owner.TEACHER)
                .extracting(SettingDefinition::name)
                .containsExactlyInAnyOrderElementsOf(SettingsCatalog.TEACHER)
                .contains("TEACHERBOX_TIMEZONE", "TEACHERBOX_IDENTITY_TEACHER_NAME", "TEACHERBOX_AI_API_KEY")
                .doesNotContain("TEACHERBOX_AI_PROXY");
        assertThat(SettingsCatalog.all()).filteredOn(SettingDefinition::live)
                .extracting(SettingDefinition::name)
                .containsExactlyInAnyOrderElementsOf(SettingsCatalog.LIVE);
        assertThat(SettingsCatalog.all()).filteredOn(setting -> setting.owner() == Owner.TEACHER)
                .allMatch(SettingDefinition::stored)
                .noneMatch(SettingDefinition::editable);
        assertThat(SettingsCatalog.all()).filteredOn(setting -> setting.owner() == Owner.ENV_ONLY)
                .noneMatch(SettingDefinition::stored);
    }

    @Test
    void aDefinitionKeepsItsOwnerConsistent() {
        assertThatThrownBy(() -> definition(Access.DOCKER, Owner.ADMIN, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> definition(Access.EDITABLE, Owner.ENV_ONLY, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> definition(Access.EDITABLE, Owner.TEACHER, true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(definition(Access.EDITABLE, Owner.ADMIN, true).editable()).isTrue();
    }

    private static SettingDefinition definition(Access access, Owner owner, boolean live) {
        Wording text = new Wording("т", "t");
        return new SettingDefinition("TEACHERBOX_X", "x", text, text, text, SettingKind.TEXT, List.of(), false,
                access, owner, live);
    }

    @Test
    void secretsAreNeverShownAndAccountsAreNotChangedHere() {
        assertThat(SettingsCatalog.all())
                .filteredOn(setting -> setting.name().matches(".*(PASSWORD|TOKEN|SECRET|API_KEY)$")
                        && !setting.name().endsWith("_RESET_PASSWORD"))
                .isNotEmpty()
                .allMatch(SettingDefinition::secret);
        assertThat(SettingsCatalog.all())
                .filteredOn(setting -> setting.name().startsWith("TEACHERBOX_IDENTITY_TEACHER_")
                        && !setting.name().equals("TEACHERBOX_IDENTITY_TEACHER_NAME"))
                .allMatch(setting -> setting.access() == Access.ACCOUNT);
        assertThat(SettingsCatalog.find("TEACHERBOX_HTTP_PORT")).get()
                .extracting(SettingDefinition::access).isEqualTo(Access.DOCKER);
        assertThat(SettingsCatalog.find("TEACHERBOX_AI_PROXY")).get().matches(SettingDefinition::editable);
        assertThat(SettingsCatalog.find("TEACHERBOX_AI_MODEL")).get().matches(setting -> !setting.editable());
        assertThat(SettingsCatalog.find("NOPE")).isEmpty();
        // one key per section, and a key never names two sections
        assertThat(SettingsCatalog.all().stream().map(setting -> setting.section() + "=" + setting.group()).distinct())
                .doesNotHaveDuplicates()
                .hasSameSizeAs(SettingsCatalog.all().stream().map(SettingDefinition::section).distinct().toList());
        assertThat(SettingsCatalog.all()).allSatisfy(setting -> {
            for (Language language : Language.values()) {
                assertThat(setting.title().in(language)).isNotBlank();
                assertThat(setting.group().in(language)).isNotBlank();
                assertThat(setting.hint().in(language).isEmpty()).as(setting.name() + " has a hint in every language")
                        .isEqualTo(setting.hint().ru().isEmpty());
            }
            assertThat(setting.title().en()).doesNotContainPattern("[\\u0400-\\u04FF]");
            assertThat(setting.hint().en()).doesNotContainPattern("[\\u0400-\\u04FF]");
            assertThat(setting.section()).matches("[a-z]+");
            assertThat(setting.kind() == SettingKind.CHOICE).isEqualTo(!setting.choices().isEmpty());
        });
    }
}
