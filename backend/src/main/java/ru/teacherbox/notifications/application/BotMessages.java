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
        @Override String helpLink(String url) { return "Справка: " + url; }
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
            return List.of(new BotCommand("menu", "Main menu"), new BotCommand("cancel", "Cancel the action"),
                    new BotCommand("help", "What the bot can do"), new BotCommand("stop", "Turn off notifications"));
        }
        @Override String menuTeacher() { return "What shall I do?"; }
        @Override String menuStudent() { return "What would you like to do?"; }
        @Override String nothingYet() { return "For now the bot only sends notifications from the portal."; }
        @Override String notUnderstood() { return "I didn't understand the message."; }
        @Override String cancelled() { return "Action cancelled."; }
        @Override String stale() { return "This button no longer works."; }
        @Override String noAccess() { return "Access to the portal is turned off."; }
        @Override String teacherOff() {
            return "Managing the portal through the bot is turned off: “Notifications” → “Messengers” on the portal. "
                    + "Notifications will keep coming.";
        }
        @Override String failed() { return "That didn't work: the data may have changed. Open the menu and try again."; }
        @Override String chooseAccount() {
            return "Several accounts are connected to this chat. On whose behalf shall I continue?";
        }
        @Override String commandsHelp() {
            return """
                    Commands:
                    /menu — main menu
                    /cancel — cancel the action
                    /stop — turn off notifications""";
        }
        @Override String canDo() { return "The bot can:"; }
        @Override String helpLink(String url) { return "Help: " + url; }
        @Override String teacher() { return "Teacher"; }
        @Override String unknownStudent() { return "Student"; }
        @Override String cancel() { return "Cancel"; }
        @Override String menu() { return "Menu"; }
        @Override String switchAccount() { return "Switch account"; }
        @Override String actingFor(String name) { return "You act on behalf of: " + name + "."; }
        @Override String linked() { return "Done! Notifications of the teacher's portal will come here. Turn off: /stop"; }
        @Override String invalidCode() {
            return "The code is not found or has expired. Get a new code in your account, “Notifications”.";
        }
        @Override String howToConnect() {
            return "Hello! This is the notification bot of the teacher's portal. To get notifications, open "
                    + "“Notifications” in your account, press “Connect” and send the code here.";
        }
        @Override String alreadyLinked() { return "This chat gets notifications of the teacher's portal. Turn off: /stop"; }
        @Override String stopped() {
            return "Notifications are turned off. You can connect again in your account, “Notifications”.";
        }
        @Override String notLinked() { return "This chat is not connected to notifications."; }
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

    abstract String cancelled();

    abstract String stale();

    abstract String noAccess();

    abstract String teacherOff();

    abstract String failed();

    abstract String chooseAccount();

    abstract String commandsHelp();

    abstract String canDo();

    abstract String helpLink(String url);

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
