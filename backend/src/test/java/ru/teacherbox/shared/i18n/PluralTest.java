package ru.teacherbox.shared.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PluralTest {

    @Test
    void russianWordsFollowTheLastDigits() {
        assertThat(Plural.russian(1, "урок", "урока", "уроков")).isEqualTo("урок");
        assertThat(Plural.russian(21, "урок", "урока", "уроков")).isEqualTo("урок");
        assertThat(Plural.russian(3, "урок", "урока", "уроков")).isEqualTo("урока");
        assertThat(Plural.russian(5, "урок", "урока", "уроков")).isEqualTo("уроков");
        assertThat(Plural.russian(12, "урок", "урока", "уроков")).isEqualTo("уроков");
        assertThat(Plural.russian(112, "урок", "урока", "уроков")).isEqualTo("уроков");
        assertThat(Plural.russian(0, "урок", "урока", "уроков")).isEqualTo("уроков");
    }

    @Test
    void englishHasOneAndMany() {
        assertThat(Plural.english(1, "lesson", "lessons")).isEqualTo("lesson");
        assertThat(Plural.english(0, "lesson", "lessons")).isEqualTo("lessons");
        assertThat(Plural.english(2, "lesson", "lessons")).isEqualTo("lessons");
    }
}
