package ru.teacherbox.ai.application;

/**
 * A material the model reads with the request: a PDF or a picture (ADR-0039).
 *
 * @param name      shown to the model, never logged
 * @param mediaType {@code application/pdf}, {@code image/png}, {@code image/jpeg}, {@code image/webp} or
 *                  {@code image/gif}
 */
public record LlmSource(String name, String mediaType, byte[] content) {

    public static final String PDF = "application/pdf";

    public boolean isPdf() {
        return PDF.equals(mediaType);
    }
}
