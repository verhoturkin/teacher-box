package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class DailyScheduleTest {

    @Test
    void aDailyCronIsOnAtItsTime() {
        assertThat(DailySchedule.of("0 30 3 * * *")).contains(new DailySchedule(true, "03:30"));
        assertThat(DailySchedule.of(" 0  5 23 * * * ")).contains(new DailySchedule(true, "23:05"));
        assertThat(DailySchedule.of("-")).contains(DailySchedule.off());
    }

    @Test
    void otherCronsHaveNoSuchForm() {
        assertThat(DailySchedule.of("0 */5 * * * *")).isEmpty();
        assertThat(DailySchedule.of("0 30 3 * * MON")).isEmpty();
        assertThat(DailySchedule.of("0 61 3 * * *")).isEmpty();
        assertThat(DailySchedule.of("0 0 24 * * *")).isEmpty();
    }

    @Test
    void writesTheCron() {
        assertThat(DailySchedule.at(LocalTime.of(4, 5)).cron()).isEqualTo("0 5 4 * * *");
        assertThat(DailySchedule.off().cron()).isEqualTo("-");
        assertThat(new DailySchedule(true, null).cron()).isEqualTo("-");
        assertThat(DailySchedule.of(DailySchedule.at(LocalTime.of(0, 0)).cron()))
                .contains(new DailySchedule(true, "00:00"));
    }
}
