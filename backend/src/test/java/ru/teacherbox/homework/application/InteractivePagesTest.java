package ru.teacherbox.homework.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class InteractivePagesTest {

    @Test
    void theBridgeGoesAfterTheDoctype() {
        assertThat(InteractivePages.withBridge("\n<!DOCTYPE html>\n<html><body>x</body></html>"))
                .isEqualTo("\n<!DOCTYPE html>\n" + InteractivePages.BRIDGE + "\n<html><body>x</body></html>");
        assertThat(InteractivePages.withBridge("<p>x</p>")).isEqualTo(InteractivePages.BRIDGE + "<p>x</p>");
        assertThat(InteractivePages.withBridge("<p>x</p><!doctype html>")).startsWith(InteractivePages.BRIDGE);
    }
}
