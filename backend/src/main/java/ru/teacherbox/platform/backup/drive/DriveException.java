package ru.teacherbox.platform.backup.drive;

/** Google did not do what the portal asked. */
public class DriveException extends RuntimeException {

    public DriveException(String message) {
        super(message);
    }
}
