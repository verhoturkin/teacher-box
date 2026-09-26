package ru.teacherbox.schedule.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Every night creates the lessons of the series for the next days of the horizon. */
@Component
class SeriesExtension {

    private static final Logger log = LoggerFactory.getLogger(SeriesExtension.class);

    private final ScheduleService schedule;

    SeriesExtension(ScheduleService schedule) {
        this.schedule = schedule;
    }

    @Scheduled(cron = "${teacherbox.schedule.extension-cron:0 20 3 * * *}",
            zone = "${teacherbox.timezone:Europe/Moscow}")
    void extend() {
        int created = schedule.extendSeries();
        if (created > 0) {
            log.info("Created {} lessons of regular series", created);
        }
    }
}
