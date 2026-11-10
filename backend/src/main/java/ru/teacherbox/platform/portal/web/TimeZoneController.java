package ru.teacherbox.platform.portal.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.portal.PortalTimeZone;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The teacher's time zone (ADR-0056): in force at once for dates, reminders and the nightly jobs; stored
 * instants keep their moment. Read with the schedule settings ({@code GET /api/me/schedule/settings}).
 */
@RestController
class TimeZoneController {

    /** @param timeZone a region, e.g. {@code Asia/Yekaterinburg} */
    record TimeZoneRequest(@NotBlank @Size(max = 60) String timeZone) {
    }

    record TimeZoneView(String timeZone) {
    }

    private final PortalTimeZone timeZone;

    TimeZoneController(PortalTimeZone timeZone) {
        this.timeZone = timeZone;
    }

    @PutMapping("/api/teacher/settings/time-zone")
    TimeZoneView change(CurrentUser user, @Valid @RequestBody TimeZoneRequest request) {
        String zone = timeZone.change(request.timeZone()).getId();
        AuditLog.record(user.id(), "time-zone", zone);
        return new TimeZoneView(zone);
    }
}
