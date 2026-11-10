package ru.teacherbox.schedule.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.time.ZonedJob;

/** Extends lesson-owned repeat rules to the rolling horizon every night. */
@Component
class OccurrenceGeneration implements ZonedJob {

    private static final Logger log = LoggerFactory.getLogger(OccurrenceGeneration.class);

    private final ScheduleService schedule;

    OccurrenceGeneration(ScheduleService schedule) {
        this.schedule = schedule;
    }

    @Override
    public String name() {
        return "occurrence-generation";
    }

    @Override
    public String cronProperty() {
        return "teacherbox.schedule.extension-cron";
    }

    @Override
    public String defaultCron() {
        return "0 20 3 * * *";
    }

    @Override
    public void run() {
        int created = schedule.generateOccurrences();
        if (created > 0) {
            log.info("Created {} repeating lesson occurrences", created);
        }
    }
}
