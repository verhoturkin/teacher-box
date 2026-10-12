package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.i18n.Language;

/**
 * Every dictionary of server texts (ADR-0036) — an enum with a constant per language and
 * {@code of(Language)} — has each language, and each of its texts gives a text in every language;
 * the English ones have no Russian words. The server's counterpart of {@code expectComplete}.
 */
class ServerDictionariesTests {

    private static final Pattern CYRILLIC = Pattern.compile("[\\u0400-\\u04FF]");
    private static final String SAMPLE = "Sample";

    @Test
    void everyDictionaryHasEveryLanguageAndEveryText() throws ReflectiveOperationException {
        List<Class<?>> dictionaries = dictionaries();
        assertThat(dictionaries).extracting(Class::getSimpleName)
                .contains("BotMessages", "ScheduleMessages", "NotificationMessages", "ScheduleChatTexts",
                        "BillingChatTexts", "ChatWords");
        for (Class<?> dictionary : dictionaries) {
            Method of = dictionary.getDeclaredMethod("of", Language.class);
            of.setAccessible(true);
            for (Language language : Language.values()) {
                Object texts = of.invoke(null, language);
                assertThat(((Enum<?>) texts).name()).as(dictionary.getSimpleName()).isEqualTo(language.name());
                for (Method text : texts(dictionary)) {
                    for (Object[] arguments : arguments(text)) {
                        Object written = text.invoke(texts, arguments);
                        String shown = written instanceof List<?> list ? list.toString() : String.valueOf(written);
                        assertThat(shown).as(dictionary.getSimpleName() + "." + text.getName() + " in " + language)
                                .isNotBlank();
                        if (language != Language.RU) {
                            assertThat(CYRILLIC.matcher(shown).find())
                                    .as(dictionary.getSimpleName() + "." + text.getName() + " in " + language + ": "
                                            + shown)
                                    .isFalse();
                        }
                    }
                }
            }
        }
    }

    /** The enums of the application with a static {@code of(Language)}. */
    private static List<Class<?>> dictionaries() {
        List<Class<?>> found = new ArrayList<>();
        for (JavaClass type : new ClassFileImporter().withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("ru.teacherbox")) {
            if (type.isEnum() && type.tryGetMethod("of", Language.class).isPresent()) {
                found.add(type.reflect());
            }
        }
        return found;
    }

    /** The texts: the methods every language implements. */
    private static List<Method> texts(Class<?> dictionary) {
        return Arrays.stream(dictionary.getDeclaredMethods())
                .filter(method -> Modifier.isAbstract(method.getModifiers()))
                .peek(method -> method.setAccessible(true))
                .toList();
    }

    /** Arguments to call a text with: each value of a boolean or an enum, sample names, numbers and lists. */
    private static List<Object[]> arguments(Method text) {
        List<Object[]> calls = new ArrayList<>();
        calls.add(new Object[0]);
        for (Class<?> type : text.getParameterTypes()) {
            List<?> values = values(type);
            calls = calls.stream()
                    .flatMap(call -> values.stream().map(value -> {
                        Object[] next = Arrays.copyOf(call, call.length + 1);
                        next[call.length] = value;
                        return next;
                    }))
                    .toList();
        }
        return calls;
    }

    private static List<?> values(Class<?> type) {
        if (type == String.class) {
            return List.of(SAMPLE);
        }
        if (type == int.class) {
            return List.of(1, 2, 5);
        }
        if (type == boolean.class) {
            return List.of(true, false);
        }
        if (type == List.class) {
            return Stream.of(List.of(), List.of(SAMPLE)).toList();
        }
        if (type.isEnum()) {
            return List.of(type.getEnumConstants());
        }
        throw new IllegalArgumentException("No sample of " + type);
    }
}
