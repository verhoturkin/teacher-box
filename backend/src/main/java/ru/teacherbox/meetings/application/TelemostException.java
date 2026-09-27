package ru.teacherbox.meetings.application;

/** Yandex OAuth or the Telemost API did not do what was asked. */
public class TelemostException extends RuntimeException {

    public TelemostException(String message) {
        super(message);
    }
}
