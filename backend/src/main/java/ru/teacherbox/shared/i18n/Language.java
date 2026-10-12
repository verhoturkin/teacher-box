package ru.teacherbox.shared.i18n;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.context.i18n.LocaleContext;
import org.springframework.context.i18n.LocaleContextHolder;

/**
 * A language of the texts the server writes (ADR-0036), the same as the interface's ({@code core/i18n/language.ts}).
 * Russian is the source: an unknown or missing language means Russian.
 *
 * <p>Texts answering a request (e.g. the settings catalog) are in the language of the request
 * ({@link #current()}); texts written for someone later (notifications, bot messages, calendars) are in
 * the language the recipient chose ({@code UserDirectory.language}).
 */
public enum Language {

    RU("ru", Locale.of("ru", "RU")),
    EN("en", Locale.UK);

    private final String code;
    private final Locale locale;

    Language(String code, Locale locale) {
        this.code = code;
        this.locale = locale;
    }

    /** {@code ru}, {@code en}. */
    public String code() {
        return code;
    }

    /** The locale of dates and numbers. */
    public Locale locale() {
        return locale;
    }

    /** The language of a code or a language tag ({@code en}, {@code en-GB}); Russian if unknown. */
    public static Language of(@Nullable String code) {
        if (code == null) {
            return RU;
        }
        String language = Locale.forLanguageTag(code.strip()).getLanguage();
        for (Language known : values()) {
            if (known.code.equals(language)) {
                return known;
            }
        }
        return RU;
    }

    /** The language of the current request ({@code Accept-Language}); Russian outside a request. */
    public static Language current() {
        LocaleContext context = LocaleContextHolder.getLocaleContext();
        Locale locale = context == null ? null : context.getLocale();
        return locale == null ? RU : of(locale.toLanguageTag());
    }
}
