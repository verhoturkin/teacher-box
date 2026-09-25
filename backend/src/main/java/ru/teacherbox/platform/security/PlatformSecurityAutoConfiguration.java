package ru.teacherbox.platform.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.JwtClaims;

/**
 * Stateless API security based on HS256-signed access tokens.
 *
 * <p>URL conventions: {@code /api/auth/**} is public, {@code /api/teacher/**} requires the teacher role,
 * the rest of {@code /api/**} requires authentication; everything else (SPA assets) is public.
 */
@AutoConfiguration(after = PlatformCoreAutoConfiguration.class, beforeName = {
        "org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.actuate.web.servlet.ManagementWebSecurityAutoConfiguration",
        "org.springframework.boot.security.oauth2.server.resource.autoconfigure.OAuth2ResourceServerAutoConfiguration",
        "org.springframework.boot.security.oauth2.server.resource.autoconfigure.web.OAuth2ResourceServerWebSecurityAutoConfiguration"
})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(PlatformSecurityProperties.class)
public class PlatformSecurityAutoConfiguration {

    /** Signing key holder so that the key is resolved once for encoder and decoder. */
    record JwtSigningKey(SecretKey key) {
    }

    @Bean
    JwtSigningKey jwtSigningKey(PlatformProperties platform, PlatformSecurityProperties security) {
        return new JwtSigningKey(JwtSecretResolver.resolve(
                security.jwtSecret(), platform.dataDir().resolve("keys").resolve("jwt-hs256.key")));
    }

    @Bean
    JwtDecoder jwtDecoder(JwtSigningKey signingKey) {
        return NimbusJwtDecoder.withSecretKey(signingKey.key()).macAlgorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    JwtEncoder jwtEncoder(JwtSigningKey signingKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(signingKey.key()));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    SecurityFilterChain apiSecurityFilterChain(HttpSecurity http) throws Exception {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName(JwtClaims.ROLE);
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();
        authenticationConverter.setJwtGrantedAuthoritiesConverter(authorities);

        http
                // Stateless bearer-token API; the refresh cookie is SameSite=Strict (see ADR-0003).
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/teacher/**").hasRole("TEACHER")
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/**").denyAll()
                        .anyRequest().permitAll())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(authenticationConverter))
                        .authenticationEntryPoint(ProblemSecurityHandlers.authenticationEntryPoint())
                        .accessDeniedHandler(ProblemSecurityHandlers.accessDeniedHandler()))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(ProblemSecurityHandlers.authenticationEntryPoint())
                        .accessDeniedHandler(ProblemSecurityHandlers.accessDeniedHandler()))
                .headers(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    WebMvcConfigurer currentUserWebMvcConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
                resolvers.add(new CurrentUserArgumentResolver());
            }
        };
    }
}
