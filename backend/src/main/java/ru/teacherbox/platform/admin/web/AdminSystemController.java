package ru.teacherbox.platform.admin.web;

import java.time.Clock;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import ru.teacherbox.platform.admin.DiagnosticsArchive;
import ru.teacherbox.platform.admin.EventPublications;
import ru.teacherbox.platform.admin.EventPublications.Publication;
import ru.teacherbox.platform.admin.IntegrationChecks;
import ru.teacherbox.platform.admin.SystemStatus;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.IntegrationStatus;
import ru.teacherbox.shared.security.CurrentUser;

/** Administrator: state, pending events, integrations and the diagnostic archive. */
@RestController
@RequestMapping("/api/admin")
class AdminSystemController {

    /** @param ids events to resubmit; empty or missing: all incomplete ones */
    record ResubmitRequest(@Nullable Set<UUID> ids) {
    }

    record ResubmitResult(int resubmitted) {
    }

    private static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
            .withZone(ZoneOffset.UTC);

    private final SystemStatus status;
    private final EventPublications events;
    private final IntegrationChecks integrations;
    private final DiagnosticsArchive diagnostics;
    private final Clock clock;

    AdminSystemController(SystemStatus status, EventPublications events, IntegrationChecks integrations,
            DiagnosticsArchive diagnostics, Clock clock) {
        this.status = status;
        this.events = events;
        this.integrations = integrations;
        this.diagnostics = diagnostics;
        this.clock = clock;
    }

    @GetMapping("/status")
    SystemStatus.Status status() {
        return status.status();
    }

    @GetMapping("/events")
    List<Publication> events() {
        return events.incomplete();
    }

    @PostMapping("/events/resubmit")
    ResubmitResult resubmit(CurrentUser user, @RequestBody ResubmitRequest request) {
        Set<UUID> ids = request.ids() == null ? Set.of() : request.ids();
        int resubmitted = events.resubmit(ids);
        AuditLog.record(user.id(), "events-resubmit", ids.isEmpty() ? "all" : ids.size() + " selected");
        return new ResubmitResult(resubmitted);
    }

    /** Talks to the external services, so it is a POST. */
    @PostMapping("/integrations/check")
    List<IntegrationStatus> checkIntegrations() {
        return integrations.run();
    }

    @GetMapping("/diagnostics")
    ResponseEntity<StreamingResponseBody> diagnostics(CurrentUser user) {
        AuditLog.record(user.id(), "diagnostics", "archive downloaded");
        String name = "teacher-box-diagnostics-" + FILE_TIME.format(clock.instant()) + ".zip";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build()
                        .toString())
                .body(diagnostics::write);
    }
}
