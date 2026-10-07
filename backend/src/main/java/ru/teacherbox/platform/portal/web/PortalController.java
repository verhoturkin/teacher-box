package ru.teacherbox.platform.portal.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.platform.portal.PortalService;
import ru.teacherbox.platform.portal.PortalService.View;
import ru.teacherbox.platform.portal.PortalSettings;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.portal.PortalAddress;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The name and the address of the portal: everyone reads them (the sign-in page shows the name), the
 * teacher changes both, the administrator changes the address (a setting of the server).
 */
@RestController
class PortalController {

    /** What every page needs: the name and the logo for the header, the color, the address for links. */
    record PublicPortal(String name, @Nullable String address, String accent, @Nullable String logo) {
    }

    /** @param accent {@code null}: the color stays */
    record ChangeRequest(@Nullable @Size(max = PortalSettings.MAX_NAME_LENGTH) String name,
            @Nullable @Size(max = PortalAddress.MAX_LENGTH) String address,
            @Nullable @Size(max = 20) String accent) {
    }

    record ChangeAddressRequest(@Nullable @Size(max = PortalAddress.MAX_LENGTH) String address) {
    }

    private final PortalService portal;

    PortalController(PortalService portal) {
        this.portal = portal;
    }

    @GetMapping("/api/public/portal")
    PublicPortal publicView() {
        View view = portal.view();
        return new PublicPortal(view.name(), view.address(), view.accent(), view.logo());
    }

    /** The default colors of the manifest: the top bar of the light theme in the default color (indigo). */
    static final String DEFAULT_THEME_COLOR = "#efecf8";
    private static final Pattern HEX_COLOR = Pattern.compile("#[0-9a-fA-F]{6}");

    /** An icon of the installed app. */
    record ManifestIcon(String src, String sizes, String type, String purpose) {
    }

    /** The web app manifest: what Android and desktop Chrome need to install the portal as an app. */
    record Manifest(String id, String name, @JsonProperty("short_name") String shortName,
            @JsonProperty("start_url") String startUrl, String scope, String display, String lang,
            @JsonProperty("theme_color") String themeColor, @JsonProperty("background_color") String backgroundColor,
            List<ManifestIcon> icons) {
    }

    /**
     * The manifest of the installed portal: its name, its logo and the colors of the system bars. The colors
     * come from the page (the M3 roles are computed there, ADR-0034): {@code theme} — the status and navigation
     * bars, {@code background} — the splash screen; anything but {@code #rrggbb} gives the default.
     */
    @GetMapping(path = "/api/public/portal/manifest.webmanifest", produces = "application/manifest+json")
    Manifest manifest(@RequestParam(required = false) @Nullable String theme,
            @RequestParam(required = false) @Nullable String background) {
        View view = portal.view();
        List<ManifestIcon> icons = new ArrayList<>();
        String logoAddress = view.logo();
        if (logoAddress != null) {
            portal.logo().ifPresent(logo -> icons.add(new ManifestIcon(logoAddress, "any", logo.contentType(), "any")));
        }
        icons.add(new ManifestIcon("/icons/icon-192.png", "192x192", "image/png", "any"));
        icons.add(new ManifestIcon("/icons/icon-512.png", "512x512", "image/png", "any"));
        icons.add(new ManifestIcon("/icons/icon-maskable-512.png", "512x512", "image/png", "maskable"));
        String themeColor = color(theme, DEFAULT_THEME_COLOR);
        return new Manifest("/", view.name(), view.name(), "/", "/", "standalone", "ru", themeColor,
                color(background, themeColor), icons);
    }

    private static String color(@Nullable String value, String fallback) {
        return value != null && HEX_COLOR.matcher(value).matches() ? value.toLowerCase(Locale.ROOT) : fallback;
    }

    /**
     * The logo for the header, the sign-in page and the browser tab. Its address changes with every new
     * logo, so it is cached; an SVG runs no scripts even when opened directly (ADR-0015).
     */
    @GetMapping(PortalService.LOGO_PATH)
    ResponseEntity<Resource> logo() {
        return portal.logo()
                .map(logo -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(logo.contentType()))
                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                        .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                        .header("X-Content-Type-Options", "nosniff")
                        .body(logo.content()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(path = "/api/teacher/portal/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    View changeLogo(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.getSize() > PortalService.MAX_LOGO_SIZE) {
            throw new BusinessRuleException("portal.logo-too-large", "The logo must be at most 1 MB");
        }
        return portal.changeLogo(file.getBytes());
    }

    @DeleteMapping("/api/teacher/portal/logo")
    View removeLogo() {
        return portal.removeLogo();
    }

    @GetMapping("/api/teacher/portal")
    View teacherView() {
        return portal.view();
    }

    @PutMapping("/api/teacher/portal")
    View change(@Valid @RequestBody ChangeRequest request) {
        return portal.change(request.name(), request.address(), request.accent());
    }

    /** The teacher finished or skipped the first setup. */
    @PostMapping("/api/teacher/portal/setup")
    View completeSetup() {
        return portal.completeSetup();
    }

    @GetMapping("/api/admin/portal")
    View adminView() {
        return portal.view();
    }

    @PutMapping("/api/admin/portal")
    View changeAddress(CurrentUser user, @Valid @RequestBody ChangeAddressRequest request) {
        View view = portal.changeAddress(request.address());
        AuditLog.record(user.id(), "portal-address", view.address() == null ? "cleared" : view.address());
        return view;
    }
}
