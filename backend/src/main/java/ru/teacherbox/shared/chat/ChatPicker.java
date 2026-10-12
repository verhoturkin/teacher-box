package ru.teacherbox.shared.chat;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import ru.teacherbox.shared.i18n.Language;

/**
 * Choosing one of many options, e.g. a student: pages of buttons and search by typed text. The
 * picker keeps its page in the state under {@value #PAGE_KEY}.
 */
public final class ChatPicker {

    static final String PICK = "pick:";
    static final String PAGE_KEY = "picker.page";
    private static final Locale RU = Locale.forLanguageTag("ru");

    /** @param id what the action gets when the option is picked */
    public record Option(String id, String label) {

        public Option {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(label, "label");
        }
    }

    public sealed interface Result {
    }

    /** The user picked an option; the state no longer has the picker's page. */
    public record Picked(String id, ChatState state) implements Result {
    }

    /** Show another page or the search results and wait. */
    public record Shown(ChatReply reply, ChatState state) implements Result {
    }

    private ChatPicker() {
    }

    /** The first page. */
    public static ChatReply show(String prompt, List<Option> options, Language language) {
        return reply(prompt, options, 0, language);
    }

    /**
     * Handles a button or a search text. A search with exactly one match picks it.
     */
    public static Result handle(String prompt, List<Option> options, ChatState state, ChatInput input,
            Language language) {
        ChatWords words = ChatWords.of(language);
        Optional<String> picked = ChatKit.choice(input, PICK);
        if (picked.isPresent()) {
            Optional<Option> option = options.stream().filter(candidate -> candidate.id().equals(picked.get())).findFirst();
            if (option.isPresent()) {
                return new Picked(option.get().id(), state.without(PAGE_KEY));
            }
            return new Shown(reply(words.gone(prompt), options, 0, language), state.without(PAGE_KEY));
        }
        Optional<Integer> page = ChatKit.page(input);
        if (page.isPresent()) {
            return new Shown(reply(prompt, options, page.get(), language),
                    state.with(PAGE_KEY, page.get().toString()));
        }
        Optional<String> query = ChatKit.text(input);
        if (query.isEmpty()) {
            int current = state.get(PAGE_KEY).map(Integer::parseInt).orElse(0);
            return new Shown(reply(prompt, options, current, language), state);
        }
        String needle = query.get().toLowerCase(RU);
        List<Option> found = options.stream()
                .filter(option -> option.label().toLowerCase(RU).contains(needle))
                .toList();
        if (found.size() == 1) {
            return new Picked(found.getFirst().id(), state.without(PAGE_KEY));
        }
        if (found.isEmpty()) {
            return new Shown(reply(words.nothingFound(query.get(), prompt), options, 0, language),
                    state.without(PAGE_KEY));
        }
        return new Shown(reply(words.severalFound(prompt), found, 0, language), state.without(PAGE_KEY));
    }

    private static ChatReply reply(String prompt, List<Option> options, int page, Language language) {
        String hint = options.size() > ChatKit.PAGE_SIZE ? "\n" + ChatWords.of(language).typePartOfName() : "";
        return ChatReply.of(prompt + hint).rows(ChatKit.page(options, page, Option::label,
                option -> PICK + option.id(), language));
    }
}
