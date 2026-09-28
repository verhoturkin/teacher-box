package ru.teacherbox.shared.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import ru.teacherbox.shared.error.BusinessRuleException;

class PortalAddressTest {

    @Test
    void keepsOnlyTheSchemeTheHostAndAnUnusualPort() {
        assertThat(PortalAddress.parse(" https://School.Example.com/ ")).contains("https://school.example.com");
        assertThat(PortalAddress.parse("HTTP://192.168.1.10:8080")).contains("http://192.168.1.10:8080");
        assertThat(PortalAddress.parse("https://school.example.com:443")).contains("https://school.example.com");
        assertThat(PortalAddress.parse("http://localhost:80")).contains("http://localhost");
        assertThat(PortalAddress.parse("http://[::1]:8091")).contains("http://[::1]:8091");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  ", "school.example.com", "ftp://school.example.com", "https://",
            "https://user@school.example.com", "https://school.example.com/portal", "https://school.example.com/?a=1",
            "https://school.example.com/#top", "https://school example.com", "javascript:alert(1)"})
    void rejectsWhatIsNotAnAddressOfThePortal(String value) {
        assertThat(PortalAddress.parse(value)).isEmpty();
        assertThatThrownBy(() -> PortalAddress.normalize(value))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo(PortalAddress.INVALID);
    }

    @Test
    void rejectsTooLongAddresses() {
        assertThat(PortalAddress.parse("https://" + "a".repeat(PortalAddress.MAX_LENGTH) + ".ru")).isEmpty();
    }

    @Test
    void linksStartWithTheAddress() {
        Portal portal = new Portal() {
            @Override
            public String name() {
                return DEFAULT_NAME;
            }

            @Override
            public Optional<String> address() {
                return Optional.of("https://school.example.com");
            }
        };

        assertThat(portal.link("/cabinet/billing")).contains("https://school.example.com/cabinet/billing");
    }
}
