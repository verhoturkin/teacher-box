package ru.teacherbox.platform.portal;

import java.time.Clock;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.shared.portal.PortalAddress;

/** The name and the address of the portal: from the settings, the address variable takes precedence. */
public class PortalService implements Portal {

    /**
     * @param address                the address links are built from
     * @param addressFromEnvironment the address comes from {@code TEACHERBOX_PUBLIC_URL} and cannot be changed
     */
    public record View(String name, @Nullable String address, boolean addressFromEnvironment) {
    }

    private final PortalSettingsRepository repository;
    private final PortalProperties properties;
    private final Clock clock;

    public PortalService(PortalSettingsRepository repository, PortalProperties properties, Clock clock) {
        this.repository = repository;
        this.properties = properties;
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
     */
    public synchronized View change(@Nullable String name, @Nullable String address) {
        PortalSettings current = repository.load();
        return view(repository.save(new PortalSettings(blankToNull(name), normalize(address), clock.instant(),
                current.version())));
    }

    public synchronized View changeAddress(@Nullable String address) {
        PortalSettings current = repository.load();
        return view(repository.save(new PortalSettings(current.name(), normalize(address), clock.instant(),
                current.version())));
    }

    private View view(PortalSettings settings) {
        String fromEnvironment = properties.address();
        return new View(settings.name() == null ? DEFAULT_NAME : settings.name(),
                fromEnvironment != null ? fromEnvironment : settings.address(), fromEnvironment != null);
    }

    private static @Nullable String normalize(@Nullable String address) {
        String value = blankToNull(address);
        return value == null ? null : PortalAddress.normalize(value);
    }

    private static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
