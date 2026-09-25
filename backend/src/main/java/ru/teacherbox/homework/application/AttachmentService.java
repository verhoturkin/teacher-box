package ru.teacherbox.homework.application;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.homework.domain.FilePolicy;
import ru.teacherbox.homework.persistence.AttachmentRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;

/** Files of assignments and submissions, stored in the {@value #NAMESPACE} storage namespace. */
@Service
public class AttachmentService {

    static final String NAMESPACE = "homework";

    /** An attachment with its content, ready to be sent to the client. */
    public record FileDownload(Attachment attachment, Resource content) {
    }

    private final AttachmentRepository attachments;
    private final FileStorage storage;
    private final HomeworkProperties properties;

    public AttachmentService(AttachmentRepository attachments, FileStorage storage, HomeworkProperties properties) {
        this.attachments = attachments;
        this.storage = storage;
        this.properties = properties;
    }

    /** Validates and stores files; must run inside the transaction that creates the owner. */
    List<Attachment> store(AttachmentOwner ownerType, UUID ownerId, List<UploadedFile> files, Instant now) {
        if (files.size() > properties.maxFilesPerUpload()) {
            throw new BusinessRuleException("file.too-many",
                    "No more than " + properties.maxFilesPerUpload() + " files at once");
        }
        List<Attachment> stored = new ArrayList<>();
        for (UploadedFile file : files) {
            String filename = FilePolicy.cleanFilename(file.filename());
            String contentType = FilePolicy.contentTypeOf(filename);
            if (file.size() > properties.maxFileSize().toBytes()) {
                throw new BusinessRuleException("file.too-large",
                        "File is larger than " + properties.maxFileSize().toMegabytes() + " MB: " + filename);
            }
            StoredFile content = storeContent(file);
            Attachment attachment = new Attachment(Ids.newId(), ownerType, ownerId, content.key(), filename,
                    contentType, content.size(), content.sha256(), now);
            attachments.insert(attachment);
            stored.add(attachment);
        }
        return stored;
    }

    Attachment load(UUID attachmentId) {
        return attachments.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("file.not-found", "File not found"));
    }

    FileDownload download(Attachment attachment) {
        return new FileDownload(attachment, storage.load(NAMESPACE, attachment.fileKey()));
    }

    void delete(Attachment attachment) {
        attachments.delete(attachment.id());
        storage.delete(NAMESPACE, attachment.fileKey());
    }

    List<Attachment> of(AttachmentOwner ownerType, UUID ownerId) {
        return attachments.findByOwner(ownerType, ownerId);
    }

    List<Attachment> of(AttachmentOwner ownerType, List<UUID> ownerIds) {
        return attachments.findByOwners(ownerType, ownerIds);
    }

    private StoredFile storeContent(UploadedFile file) {
        try (InputStream input = file.content().getInputStream()) {
            return storage.store(NAMESPACE, input);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read uploaded file " + file.filename(), e);
        }
    }
}
