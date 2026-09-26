package ru.teacherbox.meetings.application;

/** Yandex does not accept the token any more (revoked or expired): the account is connected again. */
public class TelemostAuthException extends TelemostException {

    public TelemostAuthException(String message) {
        super(message);
    }
}
