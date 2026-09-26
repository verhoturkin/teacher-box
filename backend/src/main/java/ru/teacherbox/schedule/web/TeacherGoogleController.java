package ru.teacherbox.schedule.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.google.GoogleApi;
import ru.teacherbox.schedule.google.GoogleCalendarService;
import ru.teacherbox.schedule.google.GoogleCalendarService.GoogleStatusView;
import ru.teacherbox.shared.error.BusinessRuleException;

/** The teacher's Google Calendar: the OAuth client, connecting, disconnecting and busy times. */
@RestController
@RequestMapping("/api/teacher/schedule/google")
class TeacherGoogleController {

    /** Longest period of busy times in one request. */
    static final Duration MAX_BUSY_RANGE = Duration.ofDays(62);

    record ClientRequest(@NotBlank @Size(max = 300) String clientId, @NotBlank @Size(max = 300) String clientSecret) {
    }

    /** @param origin the address the teacher opened the portal with */
    record AuthorizeRequest(@NotBlank @Size(max = 300) String origin, @NotNull Boolean busy) {
    }

    record AuthorizeResponse(String url) {
    }

    record SyncResponse(int changed) {
    }

    private final GoogleCalendarService calendar;

    TeacherGoogleController(GoogleCalendarService calendar) {
        this.calendar = calendar;
    }

    @GetMapping
    GoogleStatusView status() {
        return calendar.status();
    }

    @PutMapping("/client")
    GoogleStatusView saveClient(@Valid @RequestBody ClientRequest request) {
        calendar.saveClient(request.clientId(), request.clientSecret());
        return calendar.status();
    }

    @PostMapping("/authorize")
    AuthorizeResponse authorize(@Valid @RequestBody AuthorizeRequest request) {
        return new AuthorizeResponse(calendar.authorize(request.origin(), request.busy()));
    }

    @PostMapping("/sync")
    SyncResponse sync() {
        return new SyncResponse(calendar.sync());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void disconnect() {
        calendar.disconnect();
    }

    @GetMapping("/busy")
    List<GoogleApi.Busy> busy(@RequestParam Instant from, @RequestParam Instant to) {
        if (!to.isAfter(from) || Duration.between(from, to).compareTo(MAX_BUSY_RANGE) > 0) {
            throw new BusinessRuleException("schedule.range-invalid", "The period must be up to 62 days long");
        }
        return calendar.busy(from, to);
    }
}
