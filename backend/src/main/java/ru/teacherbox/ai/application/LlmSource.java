package ru.teacherbox.ai.application;

import java.nio.charset.StandardCharsets;

/**
 * A material the model reads with the request: a PDF or a picture (ADR-0039), or a text — the transcript of a video
 * (ADR-0047).
 *
 * @param name      shown to the model, never logged
 * @param mediaType {@code application/pdf}, {@code image/png}, {@code image/jpeg}, {@code image/webp},
 *                  {@code image/gif} or {@code text/plain} (UTF-8)
 */
public record LlmSource(String name, String mediaType, byte[] content) {

    public static final String PDF = "application/pdf";
    public static final String TEXT = "text/plain";

    public boolean isPdf() {
        return PDF.equals(mediaType);
    }

    public boolean isText() {
        return TEXT.equals(mediaType);
    }

    /** The text of a {@code text/plain} material. */
    public String text() {
        return new String(content, StandardCharsets.UTF_8);
    }
}
