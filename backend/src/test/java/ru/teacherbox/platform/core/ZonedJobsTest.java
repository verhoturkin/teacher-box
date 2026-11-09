package ru.teacherbox.platform.core;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.SimpleTriggerContext;
import ru.teacherbox.shared.settings.SettingsChanged;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.shared.time.ZonedJob;

class ZonedJobsTest {

    private static final Instant NOON = Instant.parse("2026-09-01T12:00:00Z");

    private final AtomicReference<ZoneId> zone = new AtomicReference<>(ZoneId.of("Europe/Moscow"));
    private final AtomicInteger runs = new AtomicInteger();
    private final ZonedJob backup = ZonedJob.of("backup", "teacherbox.backup.cron", "0 30 3 * * *",
            runs::incrementAndGet);
    private final ZonedJob housekeeping = ZonedJob.of("housekeeping", "teacherbox.identity.housekeeping-cron",
            "0 15 4 * * *", runs::incrementAndGet);
    private final MockEnvironment environment = new MockEnvironment();
    private final TaskScheduler scheduler = mock(TaskScheduler.class);
    private final List<ScheduledFuture<?>> futures = new ArrayList<>();
    private ZonedJobs jobs;

    @BeforeEach
    void schedule() {
        when(scheduler.schedule(any(Runnable.class), any(Trigger.class))).thenAnswer(call -> {
            ScheduledFuture<?> future = mock(ScheduledFuture.class);
            futures.add(future);
            return future;
        });
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("backup", backup);
        beans.addBean("housekeeping", housekeeping);
        beans.addBean("timeZone", new InstanceTimeZone(zone::get));
        jobs = new ZonedJobs(beans.getBeanProvider(ZonedJob.class), beans.getBeanProvider(InstanceTimeZone.class),
                environment);
        ScheduledTaskRegistrar registrar = new ScheduledTaskRegistrar();
        registrar.setTaskScheduler(scheduler);
        jobs.configureTasks(registrar);
        registrar.afterPropertiesSet();
    }

    @Test
    void firesByTheZoneInForceAndByTheNewOneAfterTheChange() {
        Trigger first = triggers(2).getFirst();
        assertThat(next(first)).as("03:30 in Moscow").isEqualTo(Instant.parse("2026-09-02T00:30:00Z"));

        zone.set(ZoneId.of("Asia/Yekaterinburg"));
        jobs.settingsChanged(new SettingsChanged(Set.of(InstanceTimeZone.SETTING)));

        verify(futures.get(0)).cancel(false);
        verify(futures.get(1)).cancel(false);
        List<Trigger> anew = triggers(4);
        assertThat(next(anew.get(2))).as("03:30 in Yekaterinburg").isEqualTo(Instant.parse("2026-09-01T22:30:00Z"));
        assertThat(next(anew.get(3))).as("04:15 in Yekaterinburg").isEqualTo(Instant.parse("2026-09-01T23:15:00Z"));
    }

    @Test
    void aChangedCronReschedulesOnlyItsJob() {
        environment.setProperty("teacherbox.backup.cron", "0 0 1 * * *");
        jobs.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_BACKUP_CRON")));

        verify(futures.get(0)).cancel(false);
        List<Trigger> all = triggers(3);
        assertThat(next(all.get(2))).isEqualTo(Instant.parse("2026-09-01T22:00:00Z"));
        assertThat(all.get(2)).hasToString("backup 0 0 1 * * *");
        jobs.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS")));
        triggers(3);
        jobs.settingsChanged(new SettingsChanged(Set.of("TEACHERBOX_BACKUP_CRON")));
        verify(futures.get(2)).cancel(false);
    }

    @Test
    void runsTheJob() {
        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler, times(2)).schedule(task.capture(), any(Trigger.class));
        task.getAllValues().forEach(Runnable::run);
        assertThat(runs).hasValue(2);
    }

    @Test
    void doesNothingBeforeTheTasksAreScheduled() {
        ZonedJobs unscheduled = new ZonedJobs(new StaticListableBeanFactory().getBeanProvider(ZonedJob.class),
                new StaticListableBeanFactory().getBeanProvider(InstanceTimeZone.class), environment);
        unscheduled.settingsChanged(new SettingsChanged(Set.of(InstanceTimeZone.SETTING)));
        ScheduledTaskRegistrar empty = new ScheduledTaskRegistrar();
        unscheduled.configureTasks(empty);
        unscheduled.settingsChanged(new SettingsChanged(Set.of(InstanceTimeZone.SETTING)));
        assertThat(empty.hasTasks()).isFalse();
    }

    private List<Trigger> triggers(int count) {
        ArgumentCaptor<Trigger> triggers = ArgumentCaptor.forClass(Trigger.class);
        verify(scheduler, times(count)).schedule(any(Runnable.class), triggers.capture());
        return triggers.getAllValues();
    }

    private static Instant next(Trigger trigger) {
        return trigger.nextExecution(new SimpleTriggerContext(Clock.fixed(NOON, ZoneOffset.UTC)));
    }
}
