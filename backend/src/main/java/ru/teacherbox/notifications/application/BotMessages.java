package ru.teacherbox.notifications.application;

import java.util.List;
import ru.teacherbox.shared.i18n.Language;

/** The bot's own texts — menu, commands, connecting a chat — in each language (ADR-0036). */
enum BotMessages {

    RU {
        @Override List<BotCommand> commands() {
            return List.of(new BotCommand("menu", "Главное меню"), new BotCommand("cancel", "Отменить действие"),
                    new BotCommand("help", "Что умеет бот"), new BotCommand("stop", "Отключить уведомления"));
        }
        @Override String menuTeacher() { return "Что сделать?"; }
        @Override String menuStudent() { return "Что вы хотите сделать?"; }
        @Override String nothingYet() { return "Пока бот только присылает уведомления с портала."; }
        @Override String notUnderstood() { return "Не понял сообщение."; }
        @Override String fileNotTaken() { return "С файлами бот пока ничего не делает."; }
        @Override String fileTooLarge() { return "Файл слишком большой: бот принимает до 20 МБ."; }
        @Override String fileFailed() { return "Не получилось получить файл. Пришлите его ещё раз."; }
        @Override String cancelled() { return "Действие отменено."; }
        @Override String stale() { return "Эта кнопка уже не действует."; }
        @Override String noAccess() { return "Доступ к порталу отключён."; }
        @Override String teacherOff() {
            return "Управление порталом через бота выключено: «Уведомления» → «Мессенджеры» на портале. "
                    + "Уведомления продолжат приходить.";
        }
        @Override String failed() { return "Не получилось: данные могли измениться. Откройте меню и попробуйте ещё раз."; }
        @Override String chooseAccount() {
            return "К этому чату подключено несколько аккаунтов. От чьего имени продолжить?";
        }
        @Override String commandsHelp() {
            return """
                    Команды:
                    /menu — главное меню
                    /cancel — отменить действие
                    /stop — отключить уведомления""";
        }
        @Override String canDo() { return "Бот умеет:"; }
        @Override String help() { return "Справка"; }
        @Override String teacher() { return "Учитель"; }
        @Override String unknownStudent() { return "Ученик"; }
        @Override String cancel() { return "Отмена"; }
        @Override String menu() { return "Меню"; }
        @Override String switchAccount() { return "Сменить аккаунт"; }
        @Override String actingFor(String name) { return "Вы действуете от имени: " + name + "."; }
        @Override String linked() { return "Готово! Уведомления с портала учителя будут приходить сюда. Отключить: /stop"; }
        @Override String invalidCode() {
            return "Код не найден или устарел. Получите новый код в личном кабинете, раздел «Уведомления».";
        }
        @Override String howToConnect() {
            return "Здравствуйте! Это бот уведомлений портала учителя. Чтобы получать уведомления, откройте в личном "
                    + "кабинете раздел «Уведомления», нажмите «Подключить» и отправьте сюда полученный код.";
        }
        @Override String alreadyLinked() { return "Этот чат получает уведомления с портала учителя. Отключить: /stop"; }
        @Override String stopped() {
            return "Уведомления отключены. Подключить снова можно в личном кабинете, раздел «Уведомления».";
        }
        @Override String notLinked() { return "Этот чат не подключён к уведомлениям."; }
    },

    EN {
        @Override List<BotCommand> commands() {
            return List.of(new BotCommand("menu", "Main menu"), new BotCommand("cancel", "Cancel current action"),
                    new BotCommand("help", "What the bot can do"), new BotCommand("stop", "Turn off notifications"));
        }
        @Override String menuTeacher() { return "What would you like to do?"; }
        @Override String menuStudent() { return "What would you like to do?"; }
        @Override String nothingYet() { return "This bot currently sends portal notifications only."; }
        @Override String notUnderstood() { return "Sorry, I didn't understand that."; }
        @Override String fileNotTaken() { return "This bot can't process files yet."; }
        @Override String fileTooLarge() { return "Files must be 20 MB or smaller."; }
        @Override String fileFailed() { return "Couldn't download the file. Please send it again."; }
        @Override String cancelled() { return "Action cancelled."; }
        @Override String stale() { return "This action is no longer available. Open the menu to continue."; }
        @Override String noAccess() { return "Your portal access has been disabled."; }
        @Override String teacherOff() {
            return "Bot controls are disabled. Enable teacher actions under “Settings” → "
                    + "“Notifications and messengers” → “What the bot can do”. You'll still receive notifications.";
        }
        @Override String failed() { return "Something changed before this action could finish. Open the menu and try again."; }
        @Override String chooseAccount() { return "Several accounts are linked to this chat. Which account would you like to use?"; }
        @Override String commandsHelp() {
            return """
                    Commands:
                    /menu — main menu
                    /cancel — cancel current action
                    /stop — turn off notifications""";
        }
        @Override String canDo() { return "The bot can:"; }
        @Override String help() { return "Help"; }
        @Override String teacher() { return "Teacher"; }
        @Override String unknownStudent() { return "Student"; }
        @Override String cancel() { return "Cancel"; }
        @Override String menu() { return "Menu"; }
        @Override String switchAccount() { return "Switch account"; }
        @Override String actingFor(String name) { return "Using account: " + name + "."; }
        @Override String linked() { return "Connected! You'll receive portal notifications here. Send /stop to turn them off."; }
        @Override String invalidCode() {
            return "This code is invalid or has expired. Get a new one in your portal account's messenger settings.";
        }
        @Override String howToConnect() {
            return "Hello! I send notifications from your teacher's portal. To connect, open your account's "
                    + "messenger settings, select “Connect” and send me the code.";
        }
        @Override String alreadyLinked() { return "This chat already receives portal notifications. Send /stop to turn them off."; }
        @Override String stopped() {
            return "Notifications turned off. Reconnect in your portal account's messenger settings.";
        }
        @Override String notLinked() { return "Notifications aren't enabled for this chat."; }
    };

    static BotMessages of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    /** The commands in the messenger's menu. */
    abstract List<BotCommand> commands();

    abstract String menuTeacher();

    abstract String menuStudent();

    abstract String nothingYet();

    abstract String notUnderstood();

    abstract String fileNotTaken();

    abstract String fileTooLarge();

    abstract String fileFailed();

    abstract String cancelled();

    abstract String stale();

    abstract String noAccess();

    abstract String teacherOff();

    abstract String failed();

    abstract String chooseAccount();

    abstract String commandsHelp();

    abstract String canDo();

    /** The button to the help article about the bot. */
    abstract String help();

    abstract String teacher();

    abstract String unknownStudent();

    abstract String cancel();

    abstract String menu();

    abstract String switchAccount();

    abstract String actingFor(String name);

    abstract String linked();

    abstract String invalidCode();

    abstract String howToConnect();

    abstract String alreadyLinked();

    abstract String stopped();

    abstract String notLinked();
}
