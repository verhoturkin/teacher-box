package ru.teacherbox.homework.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * Settings of the homework module ({@code TEACHERBOX_HOMEWORK_*}).
 *
 * @param maxFileSize       maximum size of one attached file
 * @param maxFilesPerUpload maximum number of files in one submission
 * @param dueSoonWindow     how long before the deadline the reminder is sent
 */
@ConfigurationProperties("teacherbox.homework")
public record HomeworkProperties(
        @DefaultValue("20MB") DataSize maxFileSize,
        @DefaultValue("10") int maxFilesPerUpload,
        @DefaultValue("24h") Duration dueSoonWindow) {
}
