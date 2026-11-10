package ru.teacherbox.platform.portal;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import ru.teacherbox.shared.portal.PortalAddress;

/**
 * The portal ({@code teacherbox.portal.*}). The address is the teacher's setting (ADR-0056); the domain
 * of the deployment only gives its default.
 *
 * @param domain the domain of the portal ({@code TEACHERBOX_DOMAIN}, the HTTPS certificate is issued for
 *               it); while the teacher has entered no address, links start with {@code https://<domain>}
 */
@ConfigurationProperties("teacherbox.portal")
public record PortalProperties(@Nullable String domain) {

    public PortalProperties {
        domain = domain == null || domain.isBlank() ? null : domain.strip();
    }

    /** {@code https://<domain>}; {@code null} when the domain is not set or is not a host name. */
    public @Nullable String defaultAddress() {
        return domain == null ? null : PortalAddress.parse("https://" + domain).orElse(null);
    }
}
