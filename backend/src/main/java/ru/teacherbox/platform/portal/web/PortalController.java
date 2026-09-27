package ru.teacherbox.platform.portal.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.portal.PortalService;
import ru.teacherbox.platform.portal.PortalService.View;
import ru.teacherbox.platform.portal.PortalSettings;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.portal.PortalAddress;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The name and the address of the portal: everyone reads them (the sign-in page shows the name), the
 * teacher changes both, the administrator changes the address (a setting of the server).
 */
@RestController
class PortalController {

    /** What every page needs: the name for the header and the address for links. */
    record PublicPortal(String name, @Nullable String address) {
    }

    record ChangeRequest(@Nullable @Size(max = PortalSettings.MAX_NAME_LENGTH) String name,
            @Nullable @Size(max = PortalAddress.MAX_LENGTH) String address) {
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
        return new PublicPortal(view.name(), view.address());
    }

    @GetMapping("/api/teacher/portal")
    View teacherView() {
        return portal.view();
    }

    @PutMapping("/api/teacher/portal")
    View change(@Valid @RequestBody ChangeRequest request) {
        return portal.change(request.name(), request.address());
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
