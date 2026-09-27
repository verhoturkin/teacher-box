package ru.teacherbox.shared.chat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Building blocks of dialogs: confirmation, pages of buttons, dates, time and amounts typed as text. */
public final class ChatKit {

    public static final String YES = "yes";
    public static final String NO = "no";
    public static final int PAGE_SIZE = 5;
    public static final int MAX_LABEL = 40;
    public static final int MAX_BUTTONS = 10;
    static final String PAGE = "page:";
    static final String DATE = "date:";
    private static final Locale RU = Locale.forLanguageTag("ru");
    private static final DateTimeFormatter DATE_LABEL = DateTimeFormatter.ofPattern("EE dd.MM", RU);
    private static final Pattern TIME = Pattern.compile("(\\d{1,2})\\s*[:.\\s-]\\s*(\\d{2})");
    private static final Pattern DAY_MONTH = Pattern.compile("(\\d{1,2})[./-](\\d{1,2})(?:[./-](\\d{2}|\\d{4}))?");
    private static final Pattern AMOUNT = Pattern.compile("\\d+(?:[.,]\\d{1,2})?");

    private ChatKit() {
    }

    /** Asks to confirm a change with «Да» and «Нет»; the answer comes back with the same state. */
    public static ChatStep confirm(String question, ChatState state) {
        return ChatStep.ask(ChatReply.of(question).row(ChatButton.choice("Да", YES), ChatButton.choice("Нет", NO)),
                state);
    }

    /** «Да» pressed or typed. */
    public static boolean confirmed(ChatInput input) {
        return switch (input) {
            case ChatInput.Choice choice -> YES.equals(choice.value());
            case ChatInput.Text text -> text.text().equalsIgnoreCase("да");
        };
    }

    /** The pressed button's value after the prefix, e.g. the id of {@code lesson:<id>}. */
    public static Optional<String> choice(ChatInput input, String prefix) {
        return input instanceof ChatInput.Choice(String value) && value.startsWith(prefix)
                ? Optional.of(value.substring(prefix.length()))
                : Optional.empty();
    }

    public static Optional<String> text(ChatInput input) {
        return input instanceof ChatInput.Text(String text) && !text.isEmpty() ? Optional.of(text) : Optional.empty();
    }

    /** One page of items as buttons, one per row, with «‹» and «›» to turn pages. */
    public static <T> List<List<ChatButton>> page(List<T> items, int page, Function<T, String> label,
            Function<T, String> value) {
        int pages = Math.max(1, (items.size() + PAGE_SIZE - 1) / PAGE_SIZE);
        int current = Math.clamp(page, 0, pages - 1);
        List<List<ChatButton>> rows = new ArrayList<>();
        items.stream()
                .skip((long) current * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .forEach(item -> rows.add(List.of(ChatButton.choice(label.apply(item), value.apply(item)))));
        List<ChatButton> navigation = new ArrayList<>();
        if (current > 0) {
            navigation.add(ChatButton.choice("‹ Назад", PAGE + (current - 1)));
        }
        if (current < pages - 1) {
            navigation.add(ChatButton.choice("Ещё ›", PAGE + (current + 1)));
        }
        rows.add(navigation);
        return rows.stream().filter(row -> !row.isEmpty()).toList();
    }

    /** The page asked for by «‹» or «›». */
    public static Optional<Integer> page(ChatInput input) {
        try {
            return choice(input, PAGE).map(Integer::parseInt);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** Buttons for the given number of days from {@code from}, four in a row: «пн 29.09». */
    public static List<List<ChatButton>> dates(LocalDate from, int days) {
        List<List<ChatButton>> rows = new ArrayList<>();
        List<ChatButton> row = new ArrayList<>();
        for (int day = 0; day < days; day++) {
            LocalDate date = from.plusDays(day);
            row.add(ChatButton.choice(dateLabel(date), DATE + date));
            if (row.size() == 4) {
                rows.add(List.copyOf(row));
                row.clear();
            }
        }
        rows.add(List.copyOf(row));
        return rows.stream().filter(line -> !line.isEmpty()).toList();
    }

    /**
     * A date from a date button or typed: «29.09», «29.09.2026», «сегодня», «завтра». A day and month
     * without a year mean the nearest such date from {@code today} on.
     */
    public static Optional<LocalDate> date(ChatInput input, LocalDate today) {
        Optional<String> chosen = choice(input, DATE);
        if (chosen.isPresent()) {
            try {
                return Optional.of(LocalDate.parse(chosen.get()));
            } catch (DateTimeException e) {
                return Optional.empty();
            }
        }
        return text(input).flatMap(text -> parseDate(text, today));
    }

    static Optional<LocalDate> parseDate(String text, LocalDate today) {
        String lower = text.strip().toLowerCase(RU);
        if (lower.equals("сегодня")) {
            return Optional.of(today);
        }
        if (lower.equals("завтра")) {
            return Optional.of(today.plusDays(1));
        }
        Matcher matcher = DAY_MONTH.matcher(lower);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        try {
            int day = Integer.parseInt(matcher.group(1));
            int month = Integer.parseInt(matcher.group(2));
            String year = matcher.group(3);
            if (year != null) {
                int full = Integer.parseInt(year);
                return Optional.of(LocalDate.of(year.length() == 2 ? 2000 + full : full, month, day));
            }
            LocalDate date = LocalDate.of(today.getYear(), month, day);
            return Optional.of(date.isBefore(today) ? date.plusYears(1) : date);
        } catch (DateTimeException e) {
            return Optional.empty();
        }
    }

    /** Time typed as «18:30», «18.30» or «18 30». */
    public static Optional<LocalTime> time(String text) {
        Matcher matcher = TIME.matcher(text.strip());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalTime.of(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2))));
        } catch (DateTimeException e) {
            return Optional.empty();
        }
    }

    /** An amount in rubles typed as «1500», «1 500» or «1500,50», in kopecks; positive only. */
    public static Optional<Long> amount(String text) {
        String compact = text.replaceAll("[\\s\\u00a0]", "").replaceAll("(?i)(руб\\.?|р\\.?|₽)$", "");
        if (!AMOUNT.matcher(compact).matches()) {
            return Optional.empty();
        }
        try {
            long kopecks = new BigDecimal(compact.replace(',', '.')).movePointRight(2)
                    .setScale(0, RoundingMode.UNNECESSARY).longValueExact();
            return kopecks > 0 ? Optional.of(kopecks) : Optional.empty();
        } catch (ArithmeticException e) {
            return Optional.empty();
        }
    }

    /** «пн 29.09». */
    public static String dateLabel(LocalDate date) {
        return DATE_LABEL.format(date);
    }

    /** A label that fits on a button. */
    public static String label(String text) {
        String single = text.strip().replaceAll("\\s+", " ");
        return single.length() <= MAX_LABEL ? single : single.substring(0, MAX_LABEL - 1).strip() + "…";
    }
}
