package ru.teacherbox.textbooks.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import ru.teacherbox.shared.error.BusinessRuleException;

class PageRangesTest {

    @Test
    void normalizesWhatTheTeacherWrote() {
        PageRanges ranges = PageRanges.parse(" 7, 1 – 3;2  5 -6 ");
        assertThat(ranges.text()).isEqualTo("1-3, 5-7");
        assertThat(ranges.pages()).containsExactly(1, 2, 3, 5, 6, 7);
        assertThat(ranges).hasToString("1-3, 5-7").isEqualTo(PageRanges.parse("1-3,5-7"))
                .hasSameHashCodeAs(PageRanges.parse("1—3 5—7")).isNotEqualTo("1-3, 5-7");
        assertThat(PageRanges.parse("4").text()).isEqualTo("4");
        assertThat(PageRanges.parse("1,3").text()).isEqualTo("1, 3");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", ",", "0", "3-1", "a", "1-", "1-2-3", "10001", "1-600", "1-300, 400-700"})
    void rejectsWhatIsNotPages(String value) {
        assertThatThrownBy(() -> PageRanges.parse(value)).isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "textbooks.pages-invalid");
    }

    @Test
    void rejectsTooLongText() {
        assertThatThrownBy(() -> PageRanges.parse("1, ".repeat(70))).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void checksTheEndOfTheTextbook() {
        assertThat(PageRanges.parse("2-4").within(4).text()).isEqualTo("2-4");
        assertThat(PageRanges.parse("2-40").within(null).text()).isEqualTo("2-40");
        assertThatThrownBy(() -> PageRanges.parse("2-5").within(4)).isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "textbooks.pages-beyond");
    }

    @Test
    void allPages() {
        assertThat(PageRanges.all(1).text()).isEqualTo("1");
        assertThat(PageRanges.all(0).text()).isEqualTo("1");
        assertThat(PageRanges.all(12).text()).isEqualTo("1-12");
        assertThat(PageRanges.all(900).pages()).hasSize(PageRanges.MAX_PAGES);
    }
}
