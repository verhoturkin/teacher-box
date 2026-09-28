package ru.teacherbox.schedule.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.application.OffTimeService;
import ru.teacherbox.schedule.application.ScheduleViews.OffTimePeriod;
import ru.teacherbox.schedule.application.ScheduleViews.OffTimeView;
import ru.teacherbox.schedule.domain.OffTime;
import ru.teacherbox.shared.error.BusinessRuleException;

/** The time the teacher does not work: once or weekly. */
@RestController
@RequestMapping("/api/teacher/schedule/off-times")
class TeacherOffTimeController {

    /**
     * Once: {@code startsAt} and {@code endsAt}. Weekly: {@code weekdays}, {@code startTime} and
     * {@code endTime} (local times of the instance time zone), {@code startsOn} and optional {@code endsOn}.
     */
    record OffTimeRequest(
            @NotNull OffTime.Kind kind,
            @Nullable Instant startsAt,
            @Nullable Instant endsAt,
            @Nullable Set<DayOfWeek> weekdays,
            @Nullable LocalTime startTime,
            @Nullable LocalTime endTime,
            @Nullable LocalDate startsOn,
            @Nullable LocalDate endsOn,
            @Size(max = 200) @Nullable String note) {

        OffTime.Period period() {
            return switch (kind) {
                case ONCE -> new OffTime.Once(required(startsAt), required(endsAt));
                case WEEKLY -> new OffTime.Weekly(weekdays == null ? Set.of() : weekdays, required(startTime),
                        required(endTime), required(startsOn), endsOn);
            };
        }

        private static <T> T required(@Nullable T value) {
            if (value == null) {
                throw new BusinessRuleException("schedule.off-time-invalid", "The off time is not complete");
            }
            return value;
        }
    }

    private final OffTimeService offTime;

    TeacherOffTimeController(OffTimeService offTime) {
        this.offTime = offTime;
    }

    /** Off time that is not over: weekly first, then once by its start. */
    @GetMapping
    List<OffTimeView> current() {
        return offTime.current();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    OffTimeView create(@Valid @RequestBody OffTimeRequest request) {
        return offTime.create(request.period(), request.note());
    }

    @PutMapping("/{offTimeId}")
    OffTimeView change(@PathVariable UUID offTimeId, @Valid @RequestBody OffTimeRequest request) {
        return offTime.change(offTimeId, request.period(), request.note());
    }

    @DeleteMapping("/{offTimeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID offTimeId) {
        offTime.delete(offTimeId);
    }

    /** Periods of off time in {@code [from, to)} (up to 62 days) for the calendar. */
    @GetMapping("/periods")
    List<OffTimePeriod> periods(@RequestParam Instant from, @RequestParam Instant to) {
        return offTime.periods(from, to);
    }
}
