package ru.teacherbox.platform.settings;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.util.unit.DataSize;
import ru.teacherbox.shared.i18n.Language;

/** What a setting holds and how its value is checked; an empty value is always accepted («not set»). */
public enum SettingKind {

    TEXT,
    NUMBER,
    BOOLEAN,
    /** {@code 15m}, {@code 24h}, {@code 7d} or ISO-8601 {@code PT15M}. */
    DURATION,
    /** Durations separated by commas: {@code 24h,1h}. */
    DURATIONS,
    /** {@code 20MB}. */
    DATA_SIZE,
    /** Spring cron with seconds, or {@code -} for none. */
    CRON,
    /** {@code https://host[:port]} without a path. */
    ADDRESS,
    /** Any http(s) address, e.g. an API with a path. */
    URL,
    /** {@code http://host:port} or {@code socks5://host:port}. */
    PROXY,
    TIME_ZONE,
    CURRENCY,
    /** One of {@link SettingDefinition#choices()}. */
    CHOICE;

    private static final Pattern WHOLE_NUMBER = Pattern.compile("\\d{1,12}");

    /**
     * @return what is wrong with the value, in the language of the interface; {@code null} if it fits
     */
    public @Nullable String problem(String value, List<String> choices, Language language) {
        if (value.isEmpty()) {
            return null;
        }
        boolean fits = switch (this) {
            case TEXT -> true;
            case NUMBER -> WHOLE_NUMBER.matcher(value).matches();
            case BOOLEAN -> value.equals("true") || value.equals("false");
            case DURATION -> duration(value);
            case DURATIONS -> List.of(value.split(",")).stream().allMatch(part -> duration(part.strip()));
            case DATA_SIZE -> dataSize(value);
            case CRON -> value.equals("-") || CronExpression.isValidExpression(value);
            case ADDRESS -> address(value, false);
            case URL -> address(value, true);
            case PROXY -> proxy(value);
            case TIME_ZONE -> timeZone(value);
            case CURRENCY -> currency(value);
            case CHOICE -> choices.contains(value);
        };
        return fits ? null : expected(choices, language);
    }

    /** What a value of this kind looks like. */
    String expected(List<String> choices, Language language) {
        return switch (language) {
            case RU -> switch (this) {
                case TEXT -> "нужен текст";
                case NUMBER -> "нужно целое число";
                case BOOLEAN -> "нужно true или false";
                case DURATION -> "нужна длительность, например 15m, 24h или 7d";
                case DURATIONS -> "нужны длительности через запятую, например 24h,1h";
                case DATA_SIZE -> "нужен размер, например 20MB";
                case CRON -> "нужно расписание cron из 6 частей (секунда минута час день месяц день недели) или -";
                case ADDRESS -> "нужен адрес вида https://school.example.com без пути";
                case URL -> "нужен адрес, начинающийся с http:// или https://";
                case PROXY -> "нужен адрес прокси вида http://host:port или socks5://host:port";
                case TIME_ZONE -> "нужен часовой пояс, например Europe/Moscow";
                case CURRENCY -> "нужен код валюты ISO 4217, например RUB";
                case CHOICE -> "нужно одно из значений: " + String.join(", ", choices);
            };
            case EN -> switch (this) {
                case TEXT -> "a text is needed";
                case NUMBER -> "a whole number is needed";
                case BOOLEAN -> "true or false is needed";
                case DURATION -> "a duration is needed, e.g. 15m, 24h or 7d";
                case DURATIONS -> "durations separated by commas are needed, e.g. 24h,1h";
                case DATA_SIZE -> "a size is needed, e.g. 20MB";
                case CRON -> "a cron schedule of 6 parts (second minute hour day month weekday) or - is needed";
                case ADDRESS -> "an address like https://school.example.com without a path is needed";
                case URL -> "an address starting with http:// or https:// is needed";
                case PROXY -> "a proxy address like http://host:port or socks5://host:port is needed";
                case TIME_ZONE -> "a time zone is needed, e.g. Europe/Moscow";
                case CURRENCY -> "an ISO 4217 currency code is needed, e.g. RUB";
                case CHOICE -> "one of the values is needed: " + String.join(", ", choices);
            };
        };
    }

    private static boolean duration(String value) {
        try {
            DurationStyle.detectAndParse(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean dataSize(String value) {
        try {
            DataSize.parse(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean address(String value, boolean pathAllowed) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            boolean plain = uri.getRawQuery() == null && uri.getRawFragment() == null
                    && (uri.getRawPath() == null || uri.getRawPath().isEmpty() || uri.getRawPath().equals("/"));
            return (scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null
                    && (pathAllowed || plain);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static boolean proxy(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            return (scheme.equals("http") || scheme.equals("socks5")) && uri.getHost() != null && uri.getPort() > 0;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static boolean timeZone(String value) {
        try {
            ZoneId.of(value);
            return true;
        } catch (DateTimeException e) {
            return false;
        }
    }

    private static boolean currency(String value) {
        try {
            Currency.getInstance(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
