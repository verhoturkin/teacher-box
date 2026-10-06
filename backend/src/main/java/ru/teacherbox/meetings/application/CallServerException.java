package ru.teacherbox.meetings.application;

/** The media server could not be reached or refused the request; the message holds no secrets. */
public class CallServerException extends RuntimeException {

    public CallServerException(String message) {
        super(message);
    }

    public CallServerException(String message, Throwable cause) {
        super(message, cause);
    }
}
