package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.modulith.test.Scenario;
import ru.teacherbox.billing.persistence.StudentAccountRepository;
import ru.teacherbox.identity.api.StudentRegistered;
import ru.teacherbox.testing.FakeUserDirectory;

/** Reaction to identity events. */
@BillingIntegrationTest
class StudentRegistrationIntegrationTests {

    @Autowired
    StudentAccountRepository accounts;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void opensAccountWithDefaultPriceForNewStudents(Scenario scenario) {
        UUID studentId = directory.addStudent("Новенький");

        scenario.publish(new StudentRegistered(studentId, "Новенький", Instant.now()))
                .andWaitForStateChange(() -> accounts.findById(studentId))
                .andVerify(account -> {
                    assertThat(account).isPresent();
                    assertThat(account.get().lessonPrice().amountMinor()).isEqualTo(150_000);
                });
    }

    @Test
    void registrationIsIdempotent(Scenario scenario) {
        UUID studentId = directory.addStudent("Дважды");
        StudentRegistered event = new StudentRegistered(studentId, "Дважды", Instant.now());

        scenario.publish(event).andWaitForStateChange(() -> accounts.findById(studentId)).andVerify(account ->
                assertThat(account).isPresent());
        scenario.publish(event).andWaitForStateChange(() -> accounts.findById(studentId)).andVerify(account ->
                assertThat(account.get().version()).isZero());
    }
}
