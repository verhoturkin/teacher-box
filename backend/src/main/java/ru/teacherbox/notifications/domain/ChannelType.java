package ru.teacherbox.notifications.domain;

/** External messengers that can receive notifications (the personal area inbox is always on). */
public enum ChannelType {
    TELEGRAM,
    VK,
    MAX,
    /** Web push to a browser of the user; one delivery per subscription (ADR-0051). */
    WEB_PUSH;

    /** The messengers with a bot, as opposed to web push. */
    public boolean isMessenger() {
        return this != WEB_PUSH;
    }
}
