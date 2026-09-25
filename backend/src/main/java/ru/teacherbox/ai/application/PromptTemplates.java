package ru.teacherbox.ai.application;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Prompts are versioned resources of the module ({@code classpath:ai/prompts/<name>.txt}, e.g.
 * {@code homework-draft.system.v1}). Placeholders look like <code>{{name}}</code>.
 */
@Component
public class PromptTemplates {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    /** Loads a template and fills in the values; an unknown placeholder is a programming error. */
    public String render(String name, Map<String, String> values) {
        String template = cache.computeIfAbsent(name, PromptTemplates::load);
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String value = values.get(matcher.group(1));
            if (value == null) {
                throw new IllegalArgumentException("No value for {{" + matcher.group(1) + "}} in " + name);
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);
        return result.toString().strip();
    }

    private static String load(String name) {
        String path = "ai/prompts/" + name + ".txt";
        try (InputStream in = PromptTemplates.class.getClassLoader().getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalArgumentException("Prompt not found: " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
