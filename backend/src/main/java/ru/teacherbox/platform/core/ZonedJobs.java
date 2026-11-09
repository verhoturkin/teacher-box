package ru.teacherbox.platform.core;

import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.TriggerContext;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.config.TriggerTask;
import org.springframework.scheduling.support.CronTrigger;
import ru.teacherbox.shared.settings.SettingsChanged;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.shared.time.ZonedJob;

/**
 * Schedules the modules' {@link ZonedJob}s by their cron in the instance time zone (ADR-0056). The zone and
 * the cron are read whenever the next run is computed; when either changes ({@link SettingsChanged}), the
 * waiting run is cancelled and computed anew, so a job fires by the new zone without a restart.
 */
public class ZonedJobs implements SchedulingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(ZonedJobs.class);

    private final List<ZonedJob> jobs;
    private final ObjectProvider<InstanceTimeZone> timeZone;
    private final Environment environment;
    private final Map<ZonedJob, TriggerTask> tasks = new LinkedHashMap<>();
    private final Map<ZonedJob, ScheduledTask> scheduled = new LinkedHashMap<>();
    private @Nullable ScheduledTaskRegistrar registrar;

    public ZonedJobs(ObjectProvider<ZonedJob> jobs, ObjectProvider<InstanceTimeZone> timeZone,
            Environment environment) {
        this.jobs = jobs.orderedStream().toList();
        this.timeZone = timeZone;
        this.environment = environment;
    }

    @Override
    public synchronized void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        this.registrar = taskRegistrar;
        for (ZonedJob job : jobs) {
            TriggerTask task = new TriggerTask(job::run, trigger(job));
            tasks.put(job, task);
            taskRegistrar.addTriggerTask(task);
        }
    }

    /** The trigger of a job: its cron in the zone in force at the moment the next run is computed. */
    Trigger trigger(ZonedJob job) {
        return new Trigger() {
            @Override
            public @Nullable Instant nextExecution(TriggerContext context) {
                return new CronTrigger(cron(job), zone()).nextExecution(context);
            }

            @Override
            public String toString() {
                return job.name() + " " + cron(job);
            }
        };
    }

    String cron(ZonedJob job) {
        return environment.getProperty(job.cronProperty(), job.defaultCron());
    }

    private ZoneId zone() {
        return timeZone.getObject().zoneId();
    }

    /** The time zone or a job's cron changed: the waiting runs are computed anew. */
    @EventListener
    public synchronized void settingsChanged(SettingsChanged event) {
        boolean zoneChanged = event.names().contains(InstanceTimeZone.SETTING);
        for (ZonedJob job : jobs) {
            if (zoneChanged || event.names().contains(job.cronSetting())) {
                reschedule(job);
            }
        }
    }

    private void reschedule(ZonedJob job) {
        TriggerTask task = tasks.get(job);
        if (registrar == null || task == null || registrar.getScheduler() == null) {
            return;
        }
        ScheduledTask current = scheduled.get(job);
        if (current == null) {
            current = registrar.getScheduledTasks().stream().filter(candidate -> candidate.getTask() == task)
                    .findFirst().orElse(null);
        }
        if (current != null) {
            current.cancel(false);
        }
        ScheduledTask next = registrar.scheduleTriggerTask(task);
        if (next != null) {
            scheduled.put(job, next);
        }
        log.info("Job {} scheduled anew: {} in {}", job.name(), cron(job), zone());
    }
}
