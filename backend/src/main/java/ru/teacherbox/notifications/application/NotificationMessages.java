package ru.teacherbox.notifications.application;

import ru.teacherbox.shared.i18n.Language;

/**
 * The texts {@code notifications} writes itself, in each language (ADR-0036): the buttons under a
 * notification, the reminder to connect a messenger and the test message. What a module notifies
 * about is written by that module (ADR-0061).
 */
enum NotificationMessages {

    RU {
        @Override String open() { return "Открыть"; }
        @Override String join() { return "Подключиться"; }
        @Override String connectTitle() { return "Подключите мессенджер"; }
        @Override String connectBody() {
            return "Чтобы получать уведомления в Telegram, ВКонтакте или MAX, откройте раздел «Уведомления» и нажмите "
                    + "«Подключить».";
        }
        @Override String testMessage() { return "Проверка связи: уведомления портала учителя будут приходить сюда."; }
    },

    EN {
        @Override String open() { return "Open"; }
        @Override String join() { return "Join"; }
        @Override String connectTitle() { return "Connect a messaging app"; }
        @Override String connectBody() {
            return "To receive notifications on Telegram, VK or MAX, open your portal account's messenger "
                    + "settings and select “Connect”.";
        }
        @Override String testMessage() { return "Connection successful! You'll receive portal notifications here."; }
    };

    static NotificationMessages of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    /** The button to the portal page of a notification. */
    abstract String open();

    /** The button to the video room of a notification. */
    abstract String join();

    abstract String connectTitle();

    abstract String connectBody();

    abstract String testMessage();
}
