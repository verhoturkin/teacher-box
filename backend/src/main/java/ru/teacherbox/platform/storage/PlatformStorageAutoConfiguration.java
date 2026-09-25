package ru.teacherbox.platform.storage;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.files.FileStorage;

/** File storage in {@code <data-dir>/files}. */
@AutoConfiguration(after = PlatformCoreAutoConfiguration.class)
public class PlatformStorageAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    FileStorage fileStorage(PlatformProperties properties) {
        return new LocalFileStorage(properties.dataDir().resolve("files"));
    }
}
