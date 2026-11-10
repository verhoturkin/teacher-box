package ru.teacherbox.homework.application;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * Settings of the homework module ({@code TEACHERBOX_HOMEWORK_*}); the reminder before the due date is the
 * teacher's ({@link DueSoonWindow}, ADR-0056). The administrator changes these without a restart: read them
 * through {@code shared.settings.LiveProperties} on every use.
 *
 * @param maxFileSize       maximum size of one attached file; at most {@link #FILE_SIZE_CEILING} applies
 * @param maxFilesPerUpload maximum number of files in one submission
 * @param youtubeProxy      the proxy for YouTube captions (ADR-0047); blank — direct
 */
@ConfigurationProperties("teacherbox.homework")
public record HomeworkProperties(
        @DefaultValue("20MB") DataSize maxFileSize,
        @DefaultValue("10") int maxFilesPerUpload,
        @Nullable String youtubeProxy) {

    /**
     * The largest file a homework request can carry: nginx takes requests up to 30 MB
     * ({@code client_max_body_size}), so a bigger setting is bounded by it.
     */
    public static final DataSize FILE_SIZE_CEILING = DataSize.ofMegabytes(25);

    /** {@link #maxFileSize()} bounded by {@link #FILE_SIZE_CEILING}. */
    public DataSize fileSizeLimit() {
        return maxFileSize.compareTo(FILE_SIZE_CEILING) > 0 ? FILE_SIZE_CEILING : maxFileSize;
    }

    /** The variable of {@link #youtubeProxy()}. */
    public static final String YOUTUBE_PROXY = "TEACHERBOX_HOMEWORK_YOUTUBE_PROXY";
}
