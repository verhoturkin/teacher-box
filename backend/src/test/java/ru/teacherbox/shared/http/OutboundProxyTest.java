package ru.teacherbox.shared.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.InetSocketAddress;
import java.net.Proxy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class OutboundProxyTest {

    @Test
    void emptySettingMeansDirectCalls() {
        assertThat(OutboundProxy.parse(null)).isNull();
        assertThat(OutboundProxy.parse("  ")).isNull();
        assertThat(OutboundProxy.setting("TEACHERBOX_AI_PROXY", "")).isNull();
    }

    @Test
    void readsHttpAndSocksProxies() {
        assertThat(OutboundProxy.parse(" http://host.docker.internal:8118 "))
                .isEqualTo(new OutboundProxy(OutboundProxy.Type.HTTP, "host.docker.internal", 8118));
        assertThat(OutboundProxy.parse("SOCKS5://127.0.0.1:1080"))
                .isEqualTo(new OutboundProxy(OutboundProxy.Type.SOCKS, "127.0.0.1", 1080));
        assertThat(OutboundProxy.parse("socks5h://proxy:1080")).extracting(OutboundProxy::type)
                .isEqualTo(OutboundProxy.Type.SOCKS);
        assertThat(OutboundProxy.parse("socks://proxy:1080")).extracting(OutboundProxy::type)
                .isEqualTo(OutboundProxy.Type.SOCKS);
    }

    @Test
    void convertsToAnUnresolvedJavaProxy() {
        Proxy proxy = new OutboundProxy(OutboundProxy.Type.SOCKS, "vpn", 1080).toProxy();

        assertThat(proxy.type()).isEqualTo(Proxy.Type.SOCKS);
        InetSocketAddress address = (InetSocketAddress) proxy.address();
        assertThat(address.isUnresolved()).isTrue();
        assertThat(address.getHostString()).isEqualTo("vpn");
        assertThat(address.getPort()).isEqualTo(1080);
        assertThat(new OutboundProxy(OutboundProxy.Type.HTTP, "vpn", 8118).toProxy().type())
                .isEqualTo(Proxy.Type.HTTP);
    }

    @Test
    void printsTheAddress() {
        assertThat(OutboundProxy.parse("socks5h://vpn:1080")).hasToString("socks5://vpn:1080");
        assertThat(OutboundProxy.parse("http://vpn:8118")).hasToString("http://vpn:8118");
    }

    @ParameterizedTest
    @ValueSource(strings = {"vpn:1080", "https://vpn:443", "ftp://vpn:21", "http://vpn", "http://:8080",
            "socks5://vpn:0", "socks5://vpn:70000", "http://vpn:80:80", "not a url"})
    void rejectsUnsupportedAddresses(String setting) {
        assertThatThrownBy(() -> OutboundProxy.parse(setting)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsCredentialsWithoutEchoingThem() {
        assertThatThrownBy(() -> OutboundProxy.setting("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY",
                "socks5://user:secret@vpn:1080"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY: ")
                .hasMessageContaining("login and password are not supported")
                .hasMessageNotContaining("secret");
    }

    @Test
    void validatesTheRecord() {
        assertThatThrownBy(() -> new OutboundProxy(OutboundProxy.Type.HTTP, " ", 80))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new OutboundProxy(OutboundProxy.Type.HTTP, "vpn", 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
