package ru.teacherbox.platform.backup.drive;

import java.util.Optional;
import java.util.Set;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * The Google Drive OAuth client from {@code .env} once (ADR-0056): both variables, as they were read, and
 * only when the teacher has not entered a client in the settings.
 */
public class DriveClientImport implements TeacherSettingsImport {

    static final String CLIENT_ID = "TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID";
    static final String CLIENT_SECRET = "TEACHERBOX_BACKUP_GOOGLE_CLIENT_SECRET";

    private final DriveConnectionStore store;

    public DriveClientImport(DriveConnectionStore store) {
        this.store = store;
    }

    @Override
    public Set<String> names() {
        return Set.of(CLIENT_ID, CLIENT_SECRET);
    }

    @Override
    public Set<String> importFrom(OldSettings values) {
        Optional<String> id = values.text(CLIENT_ID);
        Optional<String> secret = values.text(CLIENT_SECRET);
        if (id.isEmpty() || secret.isEmpty() || store.load().clientId() != null) {
            return Set.of();
        }
        store.update(connection -> connection.withClient(id.get(), secret.get()));
        return names();
    }
}
