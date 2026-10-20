package ru.teacherbox.boards.domain;

import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** The preview of a board is always a PNG exported by the editor; the type is checked by the first bytes. */
public final class BoardPreviews {

    public static final long MAX_SIZE = 5L * 1024 * 1024;

    private BoardPreviews() {
    }

    /** @throws BusinessRuleException {@code boards.file-type-not-allowed} when it is not a PNG */
    public static void checkType(@Nullable String declared, byte[] head) {
        if (!"image/png".equals(BoardImages.contentType(declared, head))) {
            throw new BusinessRuleException("boards.file-type-not-allowed", "The preview must be a png image");
        }
    }

    /** @throws BusinessRuleException {@code boards.file-too-large} over {@link #MAX_SIZE} */
    public static void checkSize(long size) {
        if (size > MAX_SIZE) {
            throw new BusinessRuleException("boards.file-too-large",
                    "The preview is larger than " + MAX_SIZE / 1024 / 1024 + " MB");
        }
    }
}
