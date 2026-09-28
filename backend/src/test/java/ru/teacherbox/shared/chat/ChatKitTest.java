package ru.teacherbox.shared.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import ru.teacherbox.testing.ChatSteps;

class ChatKitTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 28);

    @Test
    void confirmsWithYesAndNo() {
        ChatStep step = ChatKit.confirm("Точно?", ChatState.of("id", "1"));

        assertThat(step).isInstanceOfSatisfying(ChatStep.Ask.class, ask -> {
            assertThat(ask.reply().text()).isEqualTo("Точно?");
            assertThat(labels(ask.reply().rows())).containsExactly("Да", "Нет");
            assertThat(ask.reply().rows().getFirst()).extracting(ChatButton::label).containsExactly("✅ Да", "❌ Нет");
            assertThat(ask.state().get("id")).contains("1");
        });
        assertThat(ChatKit.confirmed(new ChatInput.Choice(ChatKit.YES))).isTrue();
        assertThat(ChatKit.confirmed(new ChatInput.Choice(ChatKit.NO))).isFalse();
        assertThat(ChatKit.confirmed(new ChatInput.Text(" Да "))).isTrue();
        assertThat(ChatKit.confirmed(new ChatInput.Text("нет"))).isFalse();
    }

    @Test
    void readsChoicesAndTexts() {
        assertThat(ChatKit.choice(new ChatInput.Choice("lesson:1"), "lesson:")).contains("1");
        assertThat(ChatKit.choice(new ChatInput.Choice("group:1"), "lesson:")).isEmpty();
        assertThat(ChatKit.choice(new ChatInput.Text("lesson:1"), "lesson:")).isEmpty();
        assertThat(ChatKit.text(new ChatInput.Text("  привет "))).contains("привет");
        assertThat(ChatKit.text(new ChatInput.Text("  "))).isEmpty();
        assertThat(ChatKit.text(new ChatInput.Choice("x"))).isEmpty();
    }

    @Test
    void pagesThroughItems() {
        List<Integer> items = IntStream.rangeClosed(1, 12).boxed().toList();

        List<List<ChatButton>> first = ChatKit.page(items, 0, String::valueOf, item -> "item:" + item);
        assertThat(first).hasSize(6);
        assertThat(first.getFirst()).containsExactly(ChatButton.choice("1", "item:1"));
        assertThat(first.getLast()).containsExactly(ChatButton.choice("Ещё ›", "page:1"));
        assertThat(labels(ChatKit.page(items, 1, String::valueOf, String::valueOf)))
                .containsExactly("6", "7", "8", "9", "10", "‹ Назад", "Ещё ›");
        assertThat(labels(ChatKit.page(items, 99, String::valueOf, String::valueOf)))
                .containsExactly("11", "12", "‹ Назад");
        assertThat(ChatKit.page(List.<Integer>of(), 0, String::valueOf, String::valueOf)).isEmpty();
        assertThat(ChatKit.page(new ChatInput.Choice("page:2"))).contains(2);
        assertThat(ChatKit.page(new ChatInput.Choice("page:x"))).isEmpty();
        assertThat(ChatKit.page(new ChatInput.Text("page:2"))).isEmpty();
    }

    @Test
    void offersDatesAndReadsThem() {
        List<List<ChatButton>> week = ChatKit.dates(TODAY, 7);
        assertThat(week).extracting(List::size).containsExactly(4, 3);
        assertThat(week.getFirst().getFirst()).isEqualTo(ChatButton.choice("пн 28.09", "date:2026-09-28"));

        assertThat(ChatKit.date(new ChatInput.Choice("date:2026-10-01"), TODAY)).contains(LocalDate.of(2026, 10, 1));
        assertThat(ChatKit.date(new ChatInput.Choice("date:2026-13-01"), TODAY)).isEmpty();
        assertThat(ChatKit.date(new ChatInput.Text("Сегодня"), TODAY)).contains(TODAY);
        assertThat(ChatKit.date(new ChatInput.Text("завтра"), TODAY)).contains(TODAY.plusDays(1));
        assertThat(ChatKit.date(new ChatInput.Text("29.09"), TODAY)).contains(LocalDate.of(2026, 9, 29));
        assertThat(ChatKit.date(new ChatInput.Text("1/9"), TODAY)).as("passed this year")
                .contains(LocalDate.of(2027, 9, 1));
        assertThat(ChatKit.date(new ChatInput.Text("1.10.26"), TODAY)).contains(LocalDate.of(2026, 10, 1));
        assertThat(ChatKit.date(new ChatInput.Text("01.10.2027"), TODAY)).contains(LocalDate.of(2027, 10, 1));
        assertThat(ChatKit.date(new ChatInput.Text("31.02"), TODAY)).isEmpty();
        assertThat(ChatKit.date(new ChatInput.Text("31.02.2026"), TODAY)).isEmpty();
        assertThat(ChatKit.date(new ChatInput.Text("когда-нибудь"), TODAY)).isEmpty();
        assertThat(ChatKit.date(new ChatInput.Choice("other"), TODAY)).isEmpty();
    }

    @Test
    void readsPastDates() {
        assertThat(ChatKit.pastDate(new ChatInput.Text("вчера"), TODAY)).contains(TODAY.minusDays(1));
        assertThat(ChatKit.pastDate(new ChatInput.Text("сегодня"), TODAY)).contains(TODAY);
        assertThat(ChatKit.pastDate(new ChatInput.Text("25.09"), TODAY)).contains(LocalDate.of(2026, 9, 25));
        assertThat(ChatKit.pastDate(new ChatInput.Text("30.09"), TODAY)).as("not yet this year")
                .contains(LocalDate.of(2025, 9, 30));
        assertThat(ChatKit.pastDate(new ChatInput.Choice("date:2026-09-27"), TODAY)).contains(LocalDate.of(2026, 9, 27));
        assertThat(ChatKit.pastDate(new ChatInput.Text("давно"), TODAY)).isEmpty();
    }

    @Test
    void readsTimeAndAmounts() {
        assertThat(ChatKit.time("18:30")).contains(LocalTime.of(18, 30));
        assertThat(ChatKit.time(" 9.05 ")).contains(LocalTime.of(9, 5));
        assertThat(ChatKit.time("18 30")).contains(LocalTime.of(18, 30));
        assertThat(ChatKit.time("25:00")).isEmpty();
        assertThat(ChatKit.time("вечером")).isEmpty();

        assertThat(ChatKit.amount("1500")).contains(150_000L);
        assertThat(ChatKit.amount("1 500,50")).contains(150_050L);
        assertThat(ChatKit.amount("1500 ₽")).contains(150_000L);
        assertThat(ChatKit.amount("1500 руб.")).contains(150_000L);
        assertThat(ChatKit.amount("0")).isEmpty();
        assertThat(ChatKit.amount("-5")).isEmpty();
        assertThat(ChatKit.amount("1.234")).isEmpty();
        assertThat(ChatKit.amount("99999999999999999999")).isEmpty();
        assertThat(ChatKit.amount("много")).isEmpty();
    }

    @Test
    void fitsLabelsOnButtons() {
        assertThat(ChatKit.label("  Мария   Иванова ")).isEqualTo("Мария Иванова");
        String long_ = ChatKit.label("x".repeat(50));
        assertThat(long_).hasSize(ChatKit.MAX_LABEL).endsWith("…");
        assertThat(ChatKit.dateLabel(TODAY)).isEqualTo("пн 28.09");
    }

    @Test
    void putsTheIconBeforeTheText() {
        assertThat(ChatIcons.with(ChatIcons.MENU, "Меню")).isEqualTo("🏠 Меню");
        assertThat(ChatIcons.with("", "Меню")).isEqualTo("Меню");
        assertThat(ChatSteps.plain("✖️ Отмена")).isEqualTo("Отмена");
        assertThat(ChatSteps.plain("‹ Назад")).isEqualTo("‹ Назад");
    }

    static List<String> labels(List<List<ChatButton>> rows) {
        return rows.stream().flatMap(List::stream).map(ChatButton::label).map(ChatSteps::plain).toList();
    }
}
