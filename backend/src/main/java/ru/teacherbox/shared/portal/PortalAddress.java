package ru.teacherbox.shared.portal;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Address of the portal: the scheme, the host and the port, e.g. {@code https://school.example.com}.
 * The portal is always served from the root of its address, so paths, queries and fragments are not
 * allowed; a trailing slash and a default port are dropped.
 */
public final class PortalAddress {

    public static final int MAX_LENGTH = 300;
    public static final String INVALID = "portal.address-invalid";

    private PortalAddress() {
    }

    /** @return the canonical form of the address, or empty if it is not an address of the portal */
    public static Optional<String> parse(String value) {
        String trimmed = value.strip();
        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH) {
            return Optional.empty();
        }
        URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String path = uri.getRawPath();
        if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null
                || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                || !(path == null || path.isEmpty() || path.equals("/"))) {
            return Optional.empty();
        }
        int port = uri.getPort();
        boolean defaultPort = port == -1 || scheme.equals("http") && port == 80 || scheme.equals("https") && port == 443;
        return Optional.of(scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT) + (defaultPort ? "" : ":" + port));
    }

    /** @throws BusinessRuleException {@value #INVALID} if it is not an address of the portal */
    public static String normalize(String value) {
        return parse(value).orElseThrow(() -> new BusinessRuleException(INVALID,
                "The portal address must look like https://school.example.com"));
    }
}
