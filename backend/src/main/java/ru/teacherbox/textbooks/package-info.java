/**
 * Textbooks (ADR-0033): the teacher's textbooks, workbooks and other materials — one file each (images, PDF,
 * DOC/DOCX), shared with students and groups; pages of a PDF cut out and rendered for homework and boards.
 */
@ApplicationModule(displayName = "Textbooks", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.textbooks;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
