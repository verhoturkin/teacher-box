package ru.teacherbox.schedule.google;

/** Google no longer accepts the portal's authorization: the teacher has to connect again. */
public class GoogleAuthException extends GoogleException {

    public GoogleAuthException(String message) {
        super(message);
    }
}
