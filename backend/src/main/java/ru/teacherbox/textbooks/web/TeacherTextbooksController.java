package ru.teacherbox.textbooks.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.application.TextbookService;
import ru.teacherbox.textbooks.application.TextbookService.TextbookView;
import ru.teacherbox.textbooks.domain.Textbook;

/** The teacher's textbooks; {@code /api/teacher/**} requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/textbooks")
class TeacherTextbooksController {

    /** @param pageCount the teacher's number of pages; used only for a Word file */
    record ChangeRequest(@NotNull TextbookKind kind, @NotBlank @Size(max = Textbook.MAX_TITLE) String title,
            @Size(max = Textbook.MAX_COURSE) @Nullable String course,
            @Min(1) @Max(Textbook.MAX_PAGE_COUNT) @Nullable Integer pageCount,
            @Size(max = 200) @Nullable List<UUID> studentIds, @Size(max = 100) @Nullable List<UUID> groupIds,
            @NotNull Long version) {
    }

    private final TextbookService textbooks;

    TeacherTextbooksController(TextbookService textbooks) {
        this.textbooks = textbooks;
    }

    /** All textbooks, newest first. */
    @GetMapping
    List<TextbookView> list() {
        return textbooks.list();
    }

    /** The fields are checked by the textbook itself (title, course, pages) and by the members' rules. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    TextbookView create(@RequestParam("file") MultipartFile file, @RequestParam TextbookKind kind,
            @RequestParam String title, @RequestParam(required = false) @Nullable String course,
            @RequestParam(required = false) @Nullable Integer pageCount,
            @RequestParam(required = false) @Nullable List<UUID> studentIds,
            @RequestParam(required = false) @Nullable List<UUID> groupIds) {
        return textbooks.create(kind, title, course, pageCount, TextbookResponses.upload(file), orEmpty(studentIds),
                orEmpty(groupIds));
    }

    @PutMapping("/{id}")
    TextbookView change(@PathVariable UUID id, @Valid @RequestBody ChangeRequest request) {
        return textbooks.change(id, request.kind(), request.title(), request.course(), request.pageCount(),
                orEmpty(request.studentIds()), orEmpty(request.groupIds()), request.version());
    }

    @PutMapping(path = "/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    TextbookView replaceFile(@PathVariable UUID id, @RequestParam("file") MultipartFile file,
            @RequestParam long version) {
        return textbooks.replaceFile(id, TextbookResponses.upload(file), version);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID id) {
        textbooks.remove(id);
    }

    @GetMapping("/{id}/file")
    ResponseEntity<Resource> download(CurrentUser user, @PathVariable UUID id) {
        return TextbookResponses.download(textbooks.download(user, id));
    }

    /** A page as a picture for a board: a PDF page rendered as PNG, an image as it is. */
    @GetMapping("/{id}/pages/{page}")
    ResponseEntity<Resource> page(@PathVariable UUID id, @PathVariable int page) {
        return TextbookResponses.picture(textbooks.page(id, page));
    }

    private static List<UUID> orEmpty(@Nullable List<UUID> ids) {
        return ids == null ? List.of() : ids;
    }
}
