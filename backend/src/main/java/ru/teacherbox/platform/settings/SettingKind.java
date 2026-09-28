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
     * @return what is wrong with the value, in Russian for the interface; {@code null} if it fits
     */
    public @Nullable String problem(String value, List<String> choices) {
        if (value.isEmpty()) {
            return null;
        }
        return switch (this) {
            case TEXT -> null;
            case NUMBER -> WHOLE_NUMBER.matcher(value).matches() ? null : "нужно целое число";
            case BOOLEAN -> value.equals("true") || value.equals("false") ? null : "нужно true или false";
            case DURATION -> duration(value) ? null : "нужна длительность, например 15m, 24h или 7d";
            case DURATIONS -> List.of(value.split(",")).stream().allMatch(part -> duration(part.strip()))
                    ? null : "нужны длительности через запятую, например 24h,1h";
            case DATA_SIZE -> dataSize(value) ? null : "нужен размер, например 20MB";
            case CRON -> value.equals("-") || CronExpression.isValidExpression(value)
                    ? null : "нужно расписание cron из 6 частей (секунда минута час день месяц день недели) или -";
            case ADDRESS -> address(value, false) ? null : "нужен адрес вида https://school.example.com без пути";
            case URL -> address(value, true) ? null : "нужен адрес, начинающийся с http:// или https://";
            case PROXY -> proxy(value) ? null : "нужен адрес прокси вида http://host:port или socks5://host:port";
            case TIME_ZONE -> timeZone(value) ? null : "нужен часовой пояс, например Europe/Moscow";
            case CURRENCY -> currency(value) ? null : "нужен код валюты ISO 4217, например RUB";
            case CHOICE -> choices.contains(value) ? null : "нужно одно из значений: " + String.join(", ", choices);
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
