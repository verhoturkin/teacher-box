package ru.teacherbox.platform.portal;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.shared.portal.PortalAddress;

/**
 * The name, the address, the color and the logo of the portal: from the settings, the address
 * variable takes precedence.
 */
public class PortalService implements Portal {

    /** Files of the platform in the storage. */
    static final String NAMESPACE = "platform";
    /** The largest logo, bytes. */
    public static final int MAX_LOGO_SIZE = 1024 * 1024;
    public static final String LOGO_PATH = "/api/public/portal/logo";

    /**
     * @param address                the address links are built from
     * @param addressFromEnvironment the address comes from {@code TEACHERBOX_PUBLIC_URL} and cannot be changed
     * @param setupCompleted         the teacher finished or skipped the first setup
     * @param accent                 the PrimeNG palette of the portal, e.g. {@code indigo}, or the own color {@code #rrggbb}
     * @param logo                   address of the logo (changes with every new logo); {@code null}: none
     */
    public record View(String name, @Nullable String address, boolean addressFromEnvironment,
            boolean setupCompleted, String accent, @Nullable String logo) {
    }

    /** The logo file to send. */
    public record LogoFile(Resource content, String contentType) {
    }

    private final PortalSettingsRepository repository;
    private final PortalProperties properties;
    private final FileStorage files;
    private final Clock clock;

    public PortalService(PortalSettingsRepository repository, PortalProperties properties, FileStorage files,
            Clock clock) {
        this.repository = repository;
        this.properties = properties;
        this.files = files;
        this.clock = clock;
    }

    @Override
    public String name() {
        String name = repository.load().name();
        return name == null ? DEFAULT_NAME : name;
    }

    @Override
    public Optional<String> address() {
        return Optional.ofNullable(properties.address()).or(() -> Optional.ofNullable(repository.load().address()));
    }

    public View view() {
        return view(repository.load());
    }

    /**
     * @param name    empty: the default name
     * @param address empty: no address (absolute links are not given out until it is set)
     * @param accent  {@code null}: the color stays
     */
    public synchronized View change(@Nullable String name, @Nullable String address, @Nullable String accent) {
        PortalSettings current = repository.load();
        PortalSettings changed = current.withNameAndAddress(blankToNull(name), normalize(address), clock.instant());
        if (accent != null) {
            changed = changed.withAccent(PortalAccent.parse(accent).orElseThrow(() -> new BusinessRuleException(
                    "portal.accent-invalid", "Unknown color of the portal")), clock.instant());
        }
        return view(repository.save(changed));
    }

    public synchronized View changeAddress(@Nullable String address) {
        PortalSettings current = repository.load();
        return view(repository.save(current.withNameAndAddress(current.name(), normalize(address), clock.instant())));
    }

    /** The first setup is finished or skipped: the wizard does not open any more. */
    public synchronized View completeSetup() {
        PortalSettings current = repository.load();
        if (current.setupCompletedAt() != null) {
            return view(current);
        }
        return view(repository.save(current.setupCompleted(clock.instant())));
    }

    /**
     * Replaces the logo (ADR-0015).
     *
     * @throws BusinessRuleException {@code portal.logo-too-large} over 1 MB, {@code portal.logo-invalid}
     *                               unless it is a PNG, JPEG, WebP or SVG image
     */
    public synchronized View changeLogo(byte[] content) {
        if (content.length > MAX_LOGO_SIZE) {
            throw new BusinessRuleException("portal.logo-too-large", "The logo must be at most 1 MB");
        }
        String contentType = LogoTypes.detect(content).orElseThrow(() -> new BusinessRuleException(
                "portal.logo-invalid", "The logo must be a PNG, JPEG, WebP or SVG image"));
        StoredFile stored = files.store(NAMESPACE, new ByteArrayInputStream(content));
        PortalSettings current = repository.load();
        PortalSettings saved = repository.save(
                current.withLogo(new PortalSettings.Logo(stored.key(), contentType), clock.instant()));
        forget(current.logo());
        return view(saved);
    }

    public synchronized View removeLogo() {
        PortalSettings current = repository.load();
        PortalSettings saved = repository.save(current.withLogo(null, clock.instant()));
        forget(current.logo());
        return view(saved);
    }

    public Optional<LogoFile> logo() {
        PortalSettings.Logo logo = repository.load().logo();
        return logo == null ? Optional.empty()
                : Optional.of(new LogoFile(files.load(NAMESPACE, logo.key()), logo.contentType()));
    }

    private void forget(PortalSettings.@Nullable Logo old) {
        if (old != null) {
            files.delete(NAMESPACE, old.key());
        }
    }

    private View view(PortalSettings settings) {
        String fromEnvironment = properties.address();
        PortalAccent accent = settings.accent() == null ? PortalAccent.DEFAULT : settings.accent();
        PortalSettings.Logo logo = settings.logo();
        return new View(settings.name() == null ? DEFAULT_NAME : settings.name(),
                fromEnvironment != null ? fromEnvironment : settings.address(), fromEnvironment != null,
                settings.setupCompletedAt() != null, accent.value(),
                logo == null ? null : LOGO_PATH + "?v=" + HexFormat.of().toHexDigits(logo.key().hashCode()));
    }

    private static @Nullable String normalize(@Nullable String address) {
        String value = blankToNull(address);
        return value == null ? null : PortalAddress.normalize(value);
    }

    private static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    /** What kind of image a logo is, by its first bytes (the name and the declared type do not count). */
    static final class LogoTypes {

        private LogoTypes() {
        }

        static Optional<String> detect(byte[] content) {
            if (startsWith(content, 0x89, 'P', 'N', 'G')) {
                return Optional.of("image/png");
            }
            if (startsWith(content, 0xFF, 0xD8, 0xFF)) {
                return Optional.of("image/jpeg");
            }
            if (content.length >= 12 && startsWith(content, 'R', 'I', 'F', 'F')
                    && content[8] == 'W' && content[9] == 'E' && content[10] == 'B' && content[11] == 'P') {
                return Optional.of("image/webp");
            }
            String text = new String(content, 0, Math.min(content.length, 4096), StandardCharsets.UTF_8)
                    .replace("﻿", "").stripLeading();
            if ((text.startsWith("<svg") || text.startsWith("<?xml")) && text.contains("<svg")) {
                return Optional.of("image/svg+xml");
            }
            return Optional.empty();
        }

        private static boolean startsWith(byte[] content, int... prefix) {
            if (content.length < prefix.length) {
                return false;
            }
            for (int i = 0; i < prefix.length; i++) {
                if ((content[i] & 0xFF) != prefix[i]) {
                    return false;
                }
            }
            return true;
        }
    }
}
