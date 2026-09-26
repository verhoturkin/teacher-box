package ru.teacherbox.schedule.google;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Syncs lessons into the teacher's Google Calendar every minute (does nothing when not connected). */
@Component
class GoogleSyncJob {

    private final GoogleCalendarService calendar;

    GoogleSyncJob(GoogleCalendarService calendar) {
        this.calendar = calendar;
    }

    @Scheduled(fixedDelayString = "${teacherbox.schedule.google.sync-interval:PT1M}", initialDelayString = "PT1M")
    void sync() {
        calendar.sync();
    }
}
