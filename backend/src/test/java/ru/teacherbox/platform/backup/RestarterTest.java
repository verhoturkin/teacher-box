package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class RestarterTest {

    @Test
    void closesTheApplicationAndExitsWithACodeTheContainerRestartsOn() throws InterruptedException {
        List<String> steps = new CopyOnWriteArrayList<>();
        CountDownLatch exited = new CountDownLatch(1);
        Restarter restarter = new Restarter(() -> steps.add("close"), code -> {
            steps.add("exit " + code);
            exited.countDown();
        }, Duration.ofMillis(10));

        restarter.restartSoon();

        assertThat(exited.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(steps).containsExactly("close", "exit 3");
    }

    @Test
    void exitsEvenWhenClosingFails() throws InterruptedException {
        CountDownLatch exited = new CountDownLatch(1);
        Restarter restarter = new Restarter(() -> {
            throw new IllegalStateException("already closed");
        }, code -> exited.countDown(), Duration.ZERO);

        restarter.restartSoon();

        assertThat(exited.await(5, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void comparesVersions() {
        assertThat(RestoreService.Versions.compare("1.3.0", "1.3.0")).isZero();
        assertThat(RestoreService.Versions.compare("1.2.0", "1.3.0")).isNegative();
        assertThat(RestoreService.Versions.compare("1.10.0", "1.9.2")).isPositive();
        assertThat(RestoreService.Versions.compare("1.3", "1.3.0")).isZero();
        assertThat(RestoreService.Versions.compare("1.4.0-SNAPSHOT", "1.3.0")).isPositive();
        assertThat(RestoreService.Versions.compare("2", "10.0")).isNegative();
    }
}
