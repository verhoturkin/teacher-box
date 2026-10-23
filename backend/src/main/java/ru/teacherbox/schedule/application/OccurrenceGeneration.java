package ru.teacherbox.schedule.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Extends lesson-owned repeat rules to the rolling horizon every night. */
@Component
class OccurrenceGeneration {

    private static final Logger log = LoggerFactory.getLogger(OccurrenceGeneration.class);

    private final ScheduleService schedule;

    OccurrenceGeneration(ScheduleService schedule) {
        this.schedule = schedule;
    }

    @Scheduled(cron = "${teacherbox.schedule.extension-cron:0 20 3 * * *}",
            zone = "${teacherbox.timezone:Europe/Moscow}")
    void extend() {
        int created = schedule.generateOccurrences();
        if (created > 0) {
            log.info("Created {} repeating lesson occurrences", created);
        }
    }
}
