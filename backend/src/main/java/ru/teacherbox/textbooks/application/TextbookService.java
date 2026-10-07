package ru.teacherbox.textbooks.application;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.core.io.Resource;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.domain.MemberType;
import ru.teacherbox.textbooks.domain.Textbook;
import ru.teacherbox.textbooks.domain.TextbookFile;
import ru.teacherbox.textbooks.domain.TextbookFiles;
import ru.teacherbox.textbooks.domain.TextbookFiles.FileType;
import ru.teacherbox.textbooks.domain.TextbookMember;
import ru.teacherbox.textbooks.persistence.TextbookRepository;

/** Textbooks, their files and who may open them (ADR-0033). */
@Service
public class TextbookService {

    static final String NAMESPACE = "textbooks";

    /** A file received from a client; its name is cleaned before it is stored. */
    public record Upload(@Nullable String filename, long size, InputStreamSource content) {
    }

    /** A student or a group of a textbook; the name is missing when the student or group is gone. */
    public record MemberView(MemberType type, UUID id, @Nullable String name) {
    }

    public record TextbookView(UUID id, TextbookKind kind, String title, @Nullable String course,
            @Nullable Integer pageCount, TextbookFormat format, String filename, String contentType, long size,
            List<MemberView> members, Instant createdAt, Instant updatedAt, long version) {
    }

    /**
     * A textbook of a student.
     *
     * @param groupNames the student's groups the textbook is shared with (empty when it is only the student's own)
     */
    public record MyTextbookView(UUID id, TextbookKind kind, String title, @Nullable String course,
            @Nullable Integer pageCount, TextbookFormat format, String filename, long size, List<String> groupNames,
            Instant updatedAt) {
    }

    /** A page as a picture. */
    public record PagePicture(String contentType, Resource content) {
    }

    private final TextbookRepository textbooks;
    private final FileStorage storage;
    private final PdfPages pdf;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final Clock clock;

    public TextbookService(TextbookRepository textbooks, FileStorage storage, PdfPages pdf, UserDirectory users,
            StudentGroups groups, Clock clock) {
        this.textbooks = textbooks;
        this.storage = storage;
        this.pdf = pdf;
        this.users = users;
        this.groups = groups;
        this.clock = clock;
    }

    /** All textbooks, newest first. */
    @Transactional(readOnly = true)
    public List<TextbookView> list() {
        return views(textbooks.findAll());
    }

    @Transactional
    public TextbookView create(TextbookKind kind, String title, @Nullable String course, @Nullable Integer pageCount,
            Upload upload, Collection<UUID> studentIds, Collection<UUID> groupIds) {
        Set<TextbookMember> members = members(studentIds, groupIds);
        requireCurrent(members);
        StoredUpload stored = store(upload);
        try {
            Textbook textbook = Textbook.created(Ids.newId(), kind, title, course, pageCount, stored.file(),
                    stored.pages(), clock.instant());
            textbooks.insert(textbook, members);
            return views(List.of(textbook)).getFirst();
        } catch (RuntimeException e) {
            storage.delete(NAMESPACE, stored.file().key());
            throw e;
        }
    }

    /**
     * New members must be current students and active groups; the ones the textbook already has stay even
     * if they left.
     *
     * @throws OptimisticLockingFailureException if the textbook was changed after {@code expectedVersion}
     */
    @Transactional
    public TextbookView change(UUID textbookId, TextbookKind kind, String title, @Nullable String course,
            @Nullable Integer pageCount, Collection<UUID> studentIds, Collection<UUID> groupIds,
            long expectedVersion) {
        Textbook textbook = expected(find(textbookId), expectedVersion);
        Set<TextbookMember> members = members(studentIds, groupIds);
        Set<TextbookMember> added = new LinkedHashSet<>(members);
        textbooks.findMembers(textbookId).forEach(added::remove);
        requireCurrent(added);
        Textbook saved = textbooks.update(textbook.changed(kind, title, course, pageCount, clock.instant()),
                Optional.of(members));
        return views(List.of(saved)).getFirst();
    }

    /**
     * Puts another file in place of the textbook's; the old one is deleted.
     *
     * @throws OptimisticLockingFailureException if the textbook was changed after {@code expectedVersion}
     */
    @Transactional
    public TextbookView replaceFile(UUID textbookId, Upload upload, long expectedVersion) {
        Textbook textbook = expected(find(textbookId), expectedVersion);
        StoredUpload stored = store(upload);
        Textbook saved;
        try {
            saved = textbooks.update(textbook.withFile(stored.file(), stored.pages(), clock.instant()),
                    Optional.empty());
        } catch (RuntimeException e) {
            storage.delete(NAMESPACE, stored.file().key());
            throw e;
        }
        storage.delete(NAMESPACE, textbook.file().key());
        return views(List.of(saved)).getFirst();
    }

    /** Deletes the textbook with its file. */
    @Transactional
    public void remove(UUID textbookId) {
        Textbook textbook = find(textbookId);
        textbooks.delete(textbookId);
        storage.delete(NAMESPACE, textbook.file().key());
    }

    /**
     * The teacher opens any textbook; a student — one they are a member of, directly or through a current
     * group. Anyone else gets 404, as if the textbook did not exist.
     */
    @Transactional(readOnly = true)
    public TextbookContent download(CurrentUser user, UUID textbookId) {
        Textbook textbook = find(textbookId);
        if (!mayAccess(user, textbook)) {
            throw notFound();
        }
        return whole(textbook);
    }

    /** The teacher's picture of a page: a PDF page rendered, an image as it is. */
    @Transactional(readOnly = true)
    public PagePicture page(UUID textbookId, int page) {
        Textbook textbook = find(textbookId);
        return switch (textbook.file().format()) {
            case IMAGE -> {
                if (page != 1) {
                    throw pageNotFound();
                }
                yield new PagePicture(textbook.file().contentType(), load(textbook));
            }
            case PDF -> new PagePicture("image/png", new ByteArrayResource(pdf.picture(load(textbook), page)));
            case DOCUMENT -> throw notPaged();
        };
    }

    /** The file for the given pages: a PDF cut to them, any other file whole. */
    @Transactional(readOnly = true)
    public TextbookContent content(UUID textbookId, PageRanges pages) {
        Textbook textbook = find(textbookId);
        if (textbook.file().format() != TextbookFormat.PDF) {
            return whole(textbook);
        }
        byte[] cut = pdf.cut(load(textbook), pages.pages());
        return new TextbookContent(baseName(textbook.file().filename()) + " (с. " + pages.text() + ").pdf",
                textbook.file().contentType(), cut.length, new ByteArrayResource(cut));
    }

    /** The student's own textbooks and those of their current groups, newest change first. */
    @Transactional(readOnly = true)
    public List<MyTextbookView> studentTextbooks(UUID studentId) {
        Map<UUID, String> mine = withGroups(studentId);
        List<Textbook> found = textbooks.findByIds(textbooks.findIdsByMembers(mine.keySet()));
        Map<UUID, List<TextbookMember>> members = textbooks.findMembers(found.stream().map(Textbook::id).toList());
        return found.stream()
                .map(textbook -> new MyTextbookView(textbook.id(), textbook.kind(), textbook.title(),
                        textbook.course(), textbook.pageCount(), textbook.file().format(),
                        textbook.file().filename(), textbook.file().size(),
                        members.getOrDefault(textbook.id(), List.of()).stream()
                                .filter(member -> member.type() == MemberType.GROUP)
                                .map(member -> mine.get(member.id()))
                                .filter(Objects::nonNull)
                                .toList(),
                        textbook.updatedAt()))
                .sorted(Comparator.comparing(MyTextbookView::updatedAt).reversed())
                .toList();
    }

    TextbookContent whole(UUID textbookId) {
        return whole(find(textbookId));
    }

    Optional<Textbook> findOptional(UUID textbookId) {
        return textbooks.findById(textbookId);
    }

    List<Textbook> findAll(Collection<UUID> textbookIds) {
        return textbooks.findByIds(textbookIds);
    }

    static NotFoundException notFound() {
        return new NotFoundException("textbooks.textbook-not-found", "Textbook not found");
    }

    static NotFoundException pageNotFound() {
        return new NotFoundException("textbooks.page-not-found", "The textbook has no such page");
    }

    private static BusinessRuleException notPaged() {
        return new BusinessRuleException("textbooks.not-paged", "Pages of a Word file cannot be shown");
    }

    private Textbook find(UUID textbookId) {
        return textbooks.findById(textbookId).orElseThrow(TextbookService::notFound);
    }

    private static Textbook expected(Textbook textbook, long expectedVersion) {
        if (textbook.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Textbook " + textbook.id() + " was modified");
        }
        return textbook;
    }

    private boolean mayAccess(CurrentUser user, Textbook textbook) {
        if (user.isTeacher()) {
            return true;
        }
        Set<UUID> memberIds = textbooks.findMembers(textbook.id()).stream().map(TextbookMember::id)
                .collect(Collectors.toSet());
        return user.role() == Role.STUDENT && (memberIds.contains(user.id())
                || groups.groupsOf(user.id()).stream().anyMatch(group -> memberIds.contains(group.id())));
    }

    private TextbookContent whole(Textbook textbook) {
        TextbookFile file = textbook.file();
        return new TextbookContent(file.filename(), file.contentType(), file.size(), load(textbook));
    }

    private Resource load(Textbook textbook) {
        return storage.load(NAMESPACE, textbook.file().key());
    }

    private record StoredUpload(TextbookFile file, int pages) {
    }

    /** Checks the file by its first bytes, stores it and counts the pages of a PDF. */
    private StoredUpload store(Upload upload) {
        TextbookFiles.checkSize(upload.size());
        String filename = TextbookFiles.cleanFilename(upload.filename());
        StoredFile stored;
        FileType type;
        try (InputStream input = new BufferedInputStream(upload.content().getInputStream())) {
            input.mark(TextbookFiles.HEAD);
            byte[] head = input.readNBytes(TextbookFiles.HEAD);
            input.reset();
            type = TextbookFiles.typeOf(filename, head);
            stored = storage.store(NAMESPACE, input);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read an uploaded textbook", e);
        }
        TextbookFile file = new TextbookFile(stored.key(), filename, type.contentType(), stored.size(), type.format());
        if (type.format() != TextbookFormat.PDF) {
            return new StoredUpload(file, 1);
        }
        try {
            return new StoredUpload(file, pdf.count(storage.load(NAMESPACE, stored.key())));
        } catch (RuntimeException e) {
            storage.delete(NAMESPACE, stored.key());
            throw e;
        }
    }

    private static String baseName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot <= 0 ? filename : filename.substring(0, dot);
    }

    /** The student (with an empty name) and their current groups by id. */
    private Map<UUID, String> withGroups(UUID studentId) {
        Map<UUID, String> ids = groups.groupsOf(studentId).stream()
                .collect(Collectors.toMap(GroupSummary::id, GroupSummary::name));
        ids.put(studentId, "");
        return ids;
    }

    private List<TextbookView> views(List<Textbook> found) {
        Map<UUID, List<TextbookMember>> members = textbooks.findMembers(found.stream().map(Textbook::id).toList());
        Set<UUID> memberIds = new HashSet<>();
        members.values().forEach(list -> list.forEach(member -> memberIds.add(member.id())));
        Map<UUID, String> names = new HashMap<>(users.findStudents(memberIds).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName)));
        groups.findGroups(memberIds).forEach(group -> names.put(group.id(), group.name()));
        return found.stream()
                .map(textbook -> new TextbookView(textbook.id(), textbook.kind(), textbook.title(), textbook.course(),
                        textbook.pageCount(), textbook.file().format(), textbook.file().filename(),
                        textbook.file().contentType(), textbook.file().size(),
                        members.getOrDefault(textbook.id(), List.of()).stream()
                                .map(member -> new MemberView(member.type(), member.id(), names.get(member.id())))
                                .toList(),
                        textbook.createdAt(), textbook.updatedAt(), textbook.version()))
                .toList();
    }

    private static Set<TextbookMember> members(Collection<UUID> studentIds, Collection<UUID> groupIds) {
        Set<TextbookMember> members = new LinkedHashSet<>();
        studentIds.forEach(id -> members.add(TextbookMember.student(id)));
        groupIds.forEach(id -> members.add(TextbookMember.group(id)));
        return members;
    }

    private void requireCurrent(Collection<TextbookMember> members) {
        List<UUID> studentIds = ids(members, MemberType.STUDENT);
        List<UUID> groupIds = ids(members, MemberType.GROUP);
        Set<UUID> current = users.findStudents(studentIds).stream().filter(StudentSummary::isCurrent)
                .map(StudentSummary::id).collect(Collectors.toSet());
        if (!current.containsAll(studentIds)) {
            throw new NotFoundException("textbooks.student-not-found", "Student not found");
        }
        Set<UUID> active = groups.findGroups(groupIds).stream().filter(group -> !group.archived())
                .map(GroupSummary::id).collect(Collectors.toSet());
        if (!active.containsAll(groupIds)) {
            throw new NotFoundException("textbooks.group-not-found", "Group not found");
        }
    }

    private static List<UUID> ids(Collection<TextbookMember> members, MemberType type) {
        return members.stream().filter(member -> member.type() == type).map(TextbookMember::id).toList();
    }
}
