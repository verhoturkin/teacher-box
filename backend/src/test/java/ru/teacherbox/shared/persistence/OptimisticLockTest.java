package ru.teacherbox.shared.persistence;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;

class OptimisticLockTest {

    @Test
    void passesWhenOneRowChanged() {
        assertThatCode(() -> OptimisticLock.requireUpdated(1, "Lesson", 7)).doesNotThrowAnyException();
    }

    @Test
    void failsWhenNoRowChanged() {
        assertThatThrownBy(() -> OptimisticLock.requireUpdated(0, "Lesson", 7))
                .isInstanceOf(OptimisticLockingFailureException.class)
                .hasMessage("Lesson 7 was modified");
    }
}
