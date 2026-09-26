package ru.teacherbox.notifications.web;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.DeliveryAdministration;
import ru.teacherbox.notifications.application.DeliveryAdministration.FailedDeliveryView;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/** Administrator: failed deliveries to messengers (ADR-0010). */
@RestController
@RequestMapping("/api/admin/notifications/deliveries")
class AdminNotificationsController {

    /** @param ids deliveries to send again; empty or missing: all the latest failed ones */
    record RetryRequest(@Nullable Set<UUID> ids) {
    }

    record RetryResult(int retried) {
    }

    private final DeliveryAdministration deliveries;

    AdminNotificationsController(DeliveryAdministration deliveries) {
        this.deliveries = deliveries;
    }

    @GetMapping
    List<FailedDeliveryView> failed() {
        return deliveries.failed();
    }

    @PostMapping("/retry")
    RetryResult retry(CurrentUser user, @RequestBody RetryRequest request) {
        Set<UUID> ids = request.ids() == null ? Set.of() : request.ids();
        int retried = deliveries.retry(ids);
        AuditLog.record(user.id(), "deliveries-retry", retried + " deliveries");
        return new RetryResult(retried);
    }
}
