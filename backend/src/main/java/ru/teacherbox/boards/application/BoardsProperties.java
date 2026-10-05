package ru.teacherbox.boards.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the boards module ({@code TEACHERBOX_BOARDS_*}).
 *
 * @param backupCron when the daily copies of the changed boards are made ({@code -} — never); read by
 *                   {@link BoardBackupJob}
 * @param backupKeep how many daily copies of each board are kept
 */
@ConfigurationProperties("teacherbox.boards")
public record BoardsProperties(
        @DefaultValue("0 0 3 * * *") String backupCron,
        @DefaultValue("7") int backupKeep) {
}
