package ru.teacherbox.notifications.webpush;

/**
 * A subscription of a device as the browser gave it.
 *
 * @param endpoint the address of the push service for this device, {@code https}
 * @param p256dh   the device's public key (65 bytes)
 * @param auth     the device's authentication secret (16 bytes)
 */
public record PushTarget(String endpoint, byte[] p256dh, byte[] auth) {

    /** Without the endpoint: it is the address of the device's account at the push service. */
    @Override
    public String toString() {
        return "PushTarget[***]";
    }
}
