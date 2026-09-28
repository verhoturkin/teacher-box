package ru.teacherbox.testing;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatStep;

/** Reading the steps of the bot's actions in tests. */
public final class ChatSteps {

    private ChatSteps() {
    }

    public static ChatAction action(List<ChatAction> actions, String id) {
        return actions.stream().filter(action -> action.id().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError("No chat action " + id));
    }

    public static ChatStep.Ask ask(ChatStep step) {
        assertThat(step).as(step.reply().text()).isInstanceOf(ChatStep.Ask.class);
        return (ChatStep.Ask) step;
    }

    public static ChatStep.Done done(ChatStep step) {
        assertThat(step).as(step.reply().text()).isInstanceOf(ChatStep.Done.class);
        return (ChatStep.Done) step;
    }

    /** Labels of the buttons as they are, icons included. */
    public static List<String> rawLabels(ChatStep step) {
        return step.reply().rows().stream().flatMap(List::stream).map(ChatButton::label).toList();
    }

    /** Labels of the buttons without their icons ({@link #plain}). */
    public static List<String> labels(ChatStep step) {
        return step.reply().rows().stream().flatMap(List::stream).map(ChatButton::label).map(ChatSteps::plain).toList();
    }

    /**
     * The label without the icon before it: «✅ Да» → «Да». Only emoji are dropped, so «‹ Назад» stays
     * as it is.
     */
    public static String plain(String label) {
        int index = 0;
        while (index < label.length()) {
            int codePoint = label.codePointAt(index);
            int type = Character.getType(codePoint);
            if (type != Character.OTHER_SYMBOL && type != Character.NON_SPACING_MARK
                    && type != Character.MATH_SYMBOL) {
                break;
            }
            index += Character.charCount(codePoint);
        }
        return index > 0 && label.startsWith(" ", index) ? label.substring(index + 1) : label;
    }

    /** The value of the choice button with a label starting with the text. */
    public static String value(ChatStep step, String labelStart) {
        return step.reply().rows().stream()
                .flatMap(List::stream)
                .filter(button -> plain(button.label()).startsWith(labelStart) && button.value() != null)
                .map(ChatButton::value)
                .findFirst()
                .orElseThrow(() -> new AssertionError("No button «" + labelStart + "» in " + step.reply()));
    }

    /** The address of the link button with the label. */
    public static String url(ChatStep step, String label) {
        return step.reply().rows().stream()
                .flatMap(List::stream)
                .filter(button -> plain(button.label()).equals(label) && button.url() != null)
                .map(ChatButton::url)
                .findFirst()
                .orElseThrow(() -> new AssertionError("No link «" + label + "» in " + step.reply()));
    }
}
