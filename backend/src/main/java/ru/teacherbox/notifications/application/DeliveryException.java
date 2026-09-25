package ru.teacherbox.notifications.application;

/**
 * A messenger did not accept a message.
 *
 * @see #isPermanent()
 */
public class DeliveryException extends RuntimeException {

    private final boolean permanent;

    public DeliveryException(String message, boolean permanent) {
        super(message);
        this.permanent = permanent;
    }

    /** {@code true} if retrying is pointless (the bot is blocked, the chat does not exist, ...). */
    public boolean isPermanent() {
        return permanent;
    }
}
