package ru.teacherbox.shared.chat;

/**
 * Icons on the buttons of the bots: emoji, which Telegram, VK and MAX show in button labels. Actions
 * and common buttons (yes and no, cancel, menu, accept, decline) carry one; buttons with data
 * (students, lessons, dates) stay plain so that several fit in a row.
 */
public final class ChatIcons {

    public static final String SCHEDULE = "📅";
    public static final String TODAY = "🗓";
    public static final String UNMARKED = "📝";
    public static final String CANCEL_LESSON = "🚫";
    public static final String MOVE_LESSON = "🔁";
    public static final String REQUESTS = "📨";
    public static final String PAYMENTS = "💰";
    public static final String ADD_LESSON = "➕";
    public static final String RECORD_PAYMENT = "💳";
    public static final String BOARDS = "🧩";
    public static final String JOIN_LESSON = "🎥";

    public static final String YES = "✅";
    public static final String NO = "❌";
    public static final String MENU = "🏠";
    public static final String CANCEL = "✖️";
    public static final String SWITCH_ACCOUNT = "🔄";
    public static final String ACCEPT = "✅";
    public static final String DECLINE = "❌";
    public static final String CHARGE = "💰";
    public static final String NO_CHARGE = "🆓";
    public static final String SKIP = "⏭️";
    public static final String CONDUCTED = "✅";
    public static final String MISSED = "🚫";
    public static final String DONE = "✔️";
    public static final String WITHDRAW = "↩️";

    private ChatIcons() {
    }

    /** «📅 Расписание»; no icon, no space. */
    public static String with(String icon, String text) {
        return icon.isEmpty() ? text : icon + " " + text;
    }
}
