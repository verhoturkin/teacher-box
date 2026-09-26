package ru.teacherbox.platform.admin.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.logging.LogLevel;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.platform.admin.LogLevels;
import ru.teacherbox.platform.admin.LogLevels.LoggerLevel;
import ru.teacherbox.platform.admin.LogSearch;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/** Administrator: the log and log levels. */
@RestController
@RequestMapping("/api/admin")
class AdminLogController {

    /** @param minutes how long the level stays (then the previous one returns) */
    record LevelRequest(@NotNull LogLevel level, @Min(1) @Max(1_440) int minutes) {
    }

    private final LogSearch search;
    private final LogLevels levels;

    AdminLogController(LogSearch search, LogLevels levels) {
        this.search = search;
        this.levels = levels;
    }

    /** @param level the least severe level to show */
    @GetMapping("/logs")
    LogSearch.Result logs(
            @RequestParam(required = false) @Nullable Instant from,
            @RequestParam(required = false) @Nullable Instant to,
            @RequestParam(required = false) LogSearch.@Nullable Level level,
            @RequestParam(required = false) @Nullable String logger,
            @RequestParam(required = false) @Nullable String text,
            @RequestParam(required = false) @Nullable String requestId,
            @RequestParam(defaultValue = "200") int limit) {
        return search.search(new LogSearch.Query(from, to, level, logger, text, requestId, limit));
    }

    @GetMapping("/loggers")
    List<LoggerLevel> loggers() {
        return levels.levels();
    }

    @PutMapping("/loggers/{name}")
    LoggerLevel change(CurrentUser user, @PathVariable String name, @Valid @RequestBody LevelRequest request) {
        LoggerLevel changed = levels.change(name, request.level(), Duration.ofMinutes(request.minutes()));
        AuditLog.record(user.id(), "log-level", name + "=" + request.level() + " for " + request.minutes() + " min");
        return changed;
    }

    @DeleteMapping("/loggers/{name}")
    LoggerLevel revert(CurrentUser user, @PathVariable String name) {
        AuditLog.record(user.id(), "log-level-revert", name);
        return levels.revert(name);
    }
}
