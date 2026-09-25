/**
 * AI assistant of the teacher: drafts of homework and reviews through a language model
 * (Anthropic Claude or an OpenAI-compatible provider). Independent of other modules: texts come
 * from the frontend in the request.
 */
@ApplicationModule(displayName = "AI", allowedDependencies = "shared")
@NullMarked
package ru.teacherbox.ai;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
