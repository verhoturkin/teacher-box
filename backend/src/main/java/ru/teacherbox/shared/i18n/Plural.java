package ru.teacherbox.shared.i18n;

/** The word for a number by the rules of the language: «1 урок», «2 урока», «5 уроков»; «1 lesson», «2 lessons». */
public final class Plural {

    private Plural() {
    }

    /** The Russian word for the count: {@code one} (1, 21), {@code few} (2–4, 22) or {@code many} (5–20, 11–14). */
    public static String russian(long count, String one, String few, String many) {
        long lastTwo = Math.abs(count) % 100;
        long last = lastTwo % 10;
        if (lastTwo >= 11 && lastTwo <= 14) {
            return many;
        }
        if (last == 1) {
            return one;
        }
        return last >= 2 && last <= 4 ? few : many;
    }

    /** The English word for the count: {@code one} for 1, {@code many} otherwise. */
    public static String english(long count, String one, String many) {
        return Math.abs(count) == 1 ? one : many;
    }
}
