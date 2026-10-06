package ru.teacherbox.identity.web;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.AccountService;

/**
 * Students' photos behind secret links: the storage key is known only to the student and the teacher, so
 * an {@code <img>} shows the photo without a token. A new photo gets a new address, so it is cached.
 */
@RestController
class AvatarController {

    private final AccountService accounts;

    AvatarController(AccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping(AccountService.AVATAR_PATH + "{key}")
    ResponseEntity<Resource> avatar(@PathVariable String key) {
        return accounts.avatar(key)
                .map(avatar -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(avatar.contentType()))
                        .header(HttpHeaders.CACHE_CONTROL, "private, max-age=31536000, immutable")
                        .header("X-Content-Type-Options", "nosniff")
                        .body(avatar.content()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
