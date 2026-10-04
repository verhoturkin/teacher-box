---
name: new-setting
description: Add a new TEACHERBOX_* environment variable / configuration property to Teacher Box everywhere it must appear (properties record, .env.example, SettingsCatalog, README, tests). Use whenever code needs a new setting.
---

# New setting `TEACHERBOX_<MODULE>_<NAME>`

1. Property in the module's `@ConfigurationProperties("teacherbox.<module>")` record (typed: `Duration`,
   `DataSize`, enums…; default in the record or `application.yaml`). Relaxed binding maps
   `TEACHERBOX_<MODULE>_<NAME>` to it.
2. `.env.example` — commented line in the module's section with a Russian explanation and the default.
3. `platform.settings.SettingsCatalog` — entry in the right section: type for validation (number, duration,
   size, cron, URL, proxy, time zone, currency, choice), secret flag for passwords/tokens/keys (shown only as
   "set / not set"), read-only for Compose variables and accounts. A test compares the catalog with
   `.env.example`.
4. README (Russian) — the settings table / integration section if users may need it.
5. A proxy for an external service: own variable `TEACHERBOX_<MODULE>_..._PROXY`, parsed by
   `OutboundProxy.setting`; Russian services go direct (ADR-0009).
6. Secrets never in the repo, logs or API responses. If the value is also editable in the UI, the env var wins
   (show it as set by the environment).
7. Tests for the new behaviour; `./mvnw clean verify` green.
