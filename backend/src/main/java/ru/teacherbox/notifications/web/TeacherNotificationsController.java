package ru.teacherbox.notifications.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.application.NotificationViews.BroadcastResult;
import ru.teacherbox.notifications.application.NotificationViews.BroadcastView;
import ru.teacherbox.notifications.application.NotificationViews.NotificationsStatus;
import ru.teacherbox.notifications.application.NotificationViews.StudentChannels;
import ru.teacherbox.notifications.application.NotificationViews.TeacherNotificationsSummary;
import ru.teacherbox.notifications.domain.InboxNotification;

/** Messages from the teacher to students and the students' messengers. */
@RestController
@RequestMapping("/api/teacher/notifications")
class TeacherNotificationsController {

    record BroadcastRequest(
            @NotBlank @Size(max = InboxNotification.MAX_TITLE) String title,
            @Size(max = InboxNotification.MAX_BODY) @Nullable String body,
            @Nullable List<UUID> studentIds) {
    }

    record RemindRequest(@Nullable List<UUID> studentIds) {
    }

    private final NotificationService notifications;

    TeacherNotificationsController(NotificationService notifications) {
        this.notifications = notifications;
    }

    /** Current students and the messengers they connected. */
    @GetMapping("/summary")
    TeacherNotificationsSummary summary() {
        return notifications.teacherSummary();
    }

    @GetMapping("/students")
    List<StudentChannels> students() {
        return notifications.studentChannels();
    }

    /** Asks students without messengers (the given ones or all) to connect one. */
    @PostMapping("/remind-connect")
    BroadcastResult remindToConnect(@RequestBody RemindRequest request) {
        return new BroadcastResult(notifications.remindToConnect(
                request.studentIds() == null ? List.of() : request.studentIds()));
    }

    @GetMapping("/broadcasts")
    List<BroadcastView> broadcasts() {
        return notifications.broadcasts();
    }

    @GetMapping("/status")
    NotificationsStatus status() {
        return notifications.status();
    }

    /** Sends a message to the given students or, without {@code studentIds}, to all current students. */
    @PostMapping("/broadcast")
    BroadcastResult broadcast(@Valid @RequestBody BroadcastRequest request) {
        return new BroadcastResult(notifications.broadcast(request.title(), request.body(),
                request.studentIds() == null ? List.of() : request.studentIds()));
    }
}
