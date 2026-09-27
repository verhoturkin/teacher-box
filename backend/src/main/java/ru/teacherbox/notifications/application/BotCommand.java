package ru.teacherbox.notifications.application;

/** A command in the bot's menu of the messenger, e.g. {@code menu} — «Главное меню». */
public record BotCommand(String command, String description) {
}
