package ru.teacherbox.homework.application;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.api.AssignmentFiles;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.shared.error.NotFoundException;

/** The files of assignments for the AI's drafts (ADR-0039). */
@Service
class AssignmentFilesFacade implements AssignmentFiles {

    private final AttachmentService attachments;

    AssignmentFilesFacade(AttachmentService attachments) {
        this.attachments = attachments;
    }

    @Override
    @Transactional(readOnly = true)
    public AssignmentFile file(UUID assignmentId, UUID attachmentId) {
        Attachment attachment = attachments.load(attachmentId);
        if (attachment.ownerType() != AttachmentOwner.ASSIGNMENT || !attachment.ownerId().equals(assignmentId)) {
            throw new NotFoundException("file.not-found", "File not found");
        }
        return new AssignmentFile(attachment.filename(), attachment.contentType(), attachment.size(),
                attachments.download(attachment).content());
    }
}
