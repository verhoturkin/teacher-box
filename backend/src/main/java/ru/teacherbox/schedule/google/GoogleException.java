package ru.teacherbox.schedule.google;

/** A call to Google failed (network, quota, unexpected answer); the sync is retried later. */
public class GoogleException extends RuntimeException {

    public GoogleException(String message) {
        super(message);
    }
}
