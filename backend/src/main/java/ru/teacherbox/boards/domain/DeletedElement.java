package ru.teacherbox.boards.domain;

import java.time.Instant;

/** Server-observed deletion; retired identities prevent resurrection by old editors. */
public record DeletedElement(String elementId, long elementVersion, Instant deletedAt, boolean retired) {
}
