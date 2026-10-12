package ru.teacherbox.platform.backup.drive;

/** Google no longer accepts the portal's access: the teacher has to connect the Drive again. */
public class DriveAuthException extends DriveException {

    public DriveAuthException(String message) {
        super(message);
    }
}
