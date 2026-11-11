package ru.teacherbox.shared.notice;

/**
 * What a notice is about: the user's preferences and the icon in the inbox go by it. A module
 * declares its kinds as an {@code enum} implementing this interface; {@code notifications} knows
 * every name (a test compares them).
 */
public interface NoticeKind {

    /** The name of the kind, e.g. the name of the enum constant. */
    String name();
}
