package ru.teacherbox.shared.chat;

import java.util.Optional;

/**
 * Something the bot can do, e.g. show the schedule or record a payment (SPI, ADR-0013). A module
 * provides actions as beans; the bot shows them in the menu of the users they are
 * {@linkplain #availableTo(ChatUser) available to}.
 *
 * <p>An action checks access like a REST endpoint does: a student sees and changes only their own
 * data. It changes only its module's data, through the module's services, and asks for confirmation
 * before a change ({@link ChatKit#confirm}). Expected refusals are answered with a clear text; an
 * exception ends the dialog with a general apology.
 */
public interface ChatAction {

    /** A unique id: lower-case letters, digits, dots and dashes, up to 32 characters (e.g. {@code schedule.cancel}). */
    String id();

    /** The menu item, e.g. «Расписание». */
    String title();

    /** Place in the menu: smaller first. */
    int order();

    boolean availableTo(ChatUser user);

    /** The user chose the action in the menu. */
    ChatStep start(ChatUser user);

    /**
     * The next message or button of the dialog; {@code state} is what the previous step asked to keep.
     * Button values starting with {@code bot:} are the bot's own and never come here.
     */
    ChatStep next(ChatUser user, ChatState state, ChatInput input);

    /** Buttons under a notification about the subject, if the action handles such subjects. */
    default Optional<ChatOffer> offer(ChatUser user, ChatSubject subject) {
        return Optional.empty();
    }
}
