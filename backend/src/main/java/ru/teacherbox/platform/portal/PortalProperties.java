package ru.teacherbox.platform.portal;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import ru.teacherbox.shared.portal.PortalAddress;

/**
 * The portal ({@code teacherbox.portal.*}).
 *
 * @param address address of the portal ({@code TEACHERBOX_PUBLIC_URL}); when set, it takes precedence
 *                over the address entered in the interface
 */
@ConfigurationProperties("teacherbox.portal")
public record PortalProperties(@Nullable String address) {

    public PortalProperties {
        if (address != null && !address.isBlank()) {
            address = PortalAddress.parse(address).orElseThrow(() -> new IllegalArgumentException(
                    "TEACHERBOX_PUBLIC_URL must be the address of the portal without a path, e.g. "
                            + "https://school.example.com"));
        } else {
            address = null;
        }
    }
}
