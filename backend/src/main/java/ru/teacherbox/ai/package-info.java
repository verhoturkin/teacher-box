/**
 * AI assistant of the teacher: drafts of homework and reviews through a language model
 * (Anthropic Claude or an OpenAI-compatible provider). Texts come from the frontend in the request; the sources of a
 * draft — textbook pages and files of an assignment — are read through their modules' facades (ADR-0039).
 */
@ApplicationModule(displayName = "AI", allowedDependencies = {"shared", "textbooks::api", "homework::api"})
@NullMarked
package ru.teacherbox.ai;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
