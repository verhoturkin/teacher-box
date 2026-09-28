package ru.teacherbox.platform.portal.web;

import jakarta.validation.Valid;
import java.io.IOException;
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
