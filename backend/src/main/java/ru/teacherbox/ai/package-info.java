/**
 * AI assistant of the teacher: drafts of homework and reviews through a language model
 * (Anthropic Claude or an OpenAI-compatible provider). Texts come from the frontend in the request; the sources of a
 * draft — textbook pages and files of an assignment — are read through their modules' facades (ADR-0039), the
 * facts of a student's period — through the journals of {@code schedule} and {@code homework} (ADR-0072).
 */
@ApplicationModule(displayName = "AI", allowedDependencies = {"shared", "textbooks::api", "homework::api", "schedule::api"})
@NullMarked
package ru.teacherbox.ai;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
