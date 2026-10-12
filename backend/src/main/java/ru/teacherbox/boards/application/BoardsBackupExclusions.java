package ru.teacherbox.boards.application;

import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.backup.BackupExclusions;

/**
 * The portal backup keeps only the current version of each board (ADR-0037): its copies and the images
 * no scene uses stay out. Rows of those images stay and are removed by the next garbage collection.
 */
@Component
class BoardsBackupExclusions implements BackupExclusions {

    private final BoardBackupService backups;

    BoardsBackupExclusions(BoardBackupService backups) {
        this.backups = backups;
    }

    @Override
    public List<String> tables() {
        return List.of("boards.board_backups");
    }

    @Override
    public String namespace() {
        return BoardService.NAMESPACE;
    }

    @Override
    public Set<String> files() {
        return backups.filesOutsideScenes();
    }
}
