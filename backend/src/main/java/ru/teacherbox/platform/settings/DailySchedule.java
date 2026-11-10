package ru.teacherbox.platform.settings;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * A {@link SettingKind#CRON} setting as the interface shows it (ADR-0056): «вкл/выкл + время». On at a time
 * is the cron {@code 0 <minute> <hour> * * *}, off is {@code -}; the interface writes these crons, while the
 * variable still takes any cron, which has no such form.
 *
 * @param enabled the job runs
 * @param time    when it runs every day, {@code HH:mm} in the instance time zone; {@code null} when off
 */
public record DailySchedule(boolean enabled, @Nullable String time) {

    private static final Pattern DAILY = Pattern.compile("0 (\\d{1,2}) (\\d{1,2}) \\* \\* \\*");
    private static final DateTimeFormatter HOURS_MINUTES = DateTimeFormatter.ofPattern("HH:mm");
    static final String OFF = "-";

    public static DailySchedule off() {
        return new DailySchedule(false, null);
    }

    public static DailySchedule at(LocalTime time) {
        return new DailySchedule(true, time.format(HOURS_MINUTES));
    }

    /** The schedule of a cron, or empty when the cron is not a daily one at a fixed time. */
    public static Optional<DailySchedule> of(String cron) {
        String value = cron.strip().replaceAll("\\s+", " ");
        if (value.equals(OFF)) {
            return Optional.of(off());
        }
        Matcher daily = DAILY.matcher(value);
        if (!daily.matches()) {
            return Optional.empty();
        }
        int minute = Integer.parseInt(daily.group(1));
        int hour = Integer.parseInt(daily.group(2));
        return minute < 60 && hour < 24 ? Optional.of(at(LocalTime.of(hour, minute))) : Optional.empty();
    }

    /** The cron the interface writes for it. */
    public String cron() {
        if (!enabled || time == null) {
            return OFF;
        }
        LocalTime at = LocalTime.parse(time, HOURS_MINUTES);
        return "0 " + at.getMinute() + " " + at.getHour() + " * * *";
    }
}
