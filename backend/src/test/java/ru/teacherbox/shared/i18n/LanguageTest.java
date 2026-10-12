package ru.teacherbox.shared.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

class LanguageTest {

    @AfterEach
    void forgetRequest() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void anUnknownOrMissingLanguageIsRussian() {
        assertThat(Language.of("en")).isEqualTo(Language.EN);
        assertThat(Language.of(" en-US ")).isEqualTo(Language.EN);
        assertThat(Language.of("ru")).isEqualTo(Language.RU);
        assertThat(Language.of("de")).isEqualTo(Language.RU);
        assertThat(Language.of("")).isEqualTo(Language.RU);
        assertThat(Language.of(null)).isEqualTo(Language.RU);
        assertThat(Language.EN.code()).isEqualTo("en");
        assertThat(Language.RU.locale()).isEqualTo(Locale.of("ru", "RU"));
    }

    @Test
    void theCurrentLanguageIsTheRequests() {
        assertThat(Language.current()).isEqualTo(Language.RU);
        LocaleContextHolder.setLocale(Locale.UK);
        assertThat(Language.current()).isEqualTo(Language.EN);
        LocaleContextHolder.setLocaleContext(() -> null);
        assertThat(Language.current()).isEqualTo(Language.RU);
    }
}
