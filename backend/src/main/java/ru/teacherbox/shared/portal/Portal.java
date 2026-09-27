package ru.teacherbox.shared.portal;

import java.util.Optional;

/**
 * The portal as its users know it: its name and its address (ADR-0014). Every absolute link the
 * portal gives out (messenger messages, the bot's help, OAuth redirect addresses, invitations,
 * calendar feeds) starts with {@link #address()}. Implemented by the platform.
 */
public interface Portal {

    /** Name of a portal the teacher has not named. */
    String DEFAULT_NAME = "Teacher Box";

    /** Shown in the header, the browser tab, on the sign-in page and in calendars. */
    String name();

    /** E.g. {@code https://school.example.com}, see {@link PortalAddress}; empty until it is set. */
    Optional<String> address();

    /** @param path a path of the portal starting with {@code /}, e.g. {@code /cabinet/billing} */
    default Optional<String> link(String path) {
        return address().map(address -> address + path);
    }
}
