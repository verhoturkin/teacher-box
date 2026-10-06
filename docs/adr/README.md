# Architecture Decision Records

ADRs are the **history of decisions** (context → decision → consequences), written in Russian and not
rewritten afterwards. Current rules live in the specs; read an ADR only to learn *why* something is so.

- Architecture and conventions — [`AGENTS.md`](../../AGENTS.md), [`backend/AGENTS.md`](../../backend/AGENTS.md),
  [`frontend/AGENTS.md`](../../frontend/AGENTS.md).
- UI — [`docs/design-system.md`](../design-system.md) (consolidates ADR-0015, 0017–0027).
- Modules — [`docs/modules/`](../modules).

A new ADR: next number, `NNNN-short-name.md`, sections «Контекст», «Решение», «Последствия», header with
«Статус», «Дата» and «Уточняет» / «Заменяет». Add a row below and update the spec it changes in the same
commit.

| ADR | Decision | Status | Spec |
|---|---|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith on Spring Modulith | active | AGENTS.md §4 |
| [0002](0002-embedded-database.md) | H2 file mode, schema per module | active | AGENTS.md §4.2, backend |
| [0003](0003-authentication.md) | Invites, JWT, refresh-token rotation | active | [identity](../modules/identity.md) |
| [0004](0004-delivery-variants.md) | Two Docker Compose variants (split, single) | active (single removed — 0031) | README |
| [0005](0005-notifications.md) | Notifications: inbox + outbox + channel adapters | active | [notifications](../modules/notifications.md) |
| [0006](0006-ai-integration.md) | AI module with provider-agnostic SPI; Gemini | active | [ai](../modules/ai.md) |
| [0007](0007-frontend-stack-licensing.md) | Angular 21 LTS + PrimeNG 21 (MIT), version caps | active | frontend |
| [0008](0008-schedule.md) | Schedule, series, requests, reminders, ICS, Google Calendar, off-time | active | [schedule](../modules/schedule.md) |
| [0009](0009-external-integrations.md) | Outbound proxy, integration settings | active | backend |
| [0010](0010-administrator-and-diagnostics.md) | ADMIN role, logs, request id, diagnostics | active | [platform](../modules/platform.md) |
| [0011](0011-groups-and-group-lessons.md) | Student groups and group lessons | active | identity, schedule, billing |
| [0012](0012-meetings-and-boards.md) | Telemost rooms; Холст boards | boards part superseded by 0028, Telemost part by 0030 | [meetings](../modules/meetings.md), [boards](../modules/boards.md) |
| [0013](0013-bot-dialogs.md) | Messenger bot dialogs (`ChatAction` SPI) | active | [notifications](../modules/notifications.md) |
| [0014](0014-portal-settings-reset-and-restore.md) | Portal name/URL, first-run setup, restore, full reset | active | [platform](../modules/platform.md) |
| [0015](0015-design-system-and-mobile.md) | Tokens, themes, portal colour, mobile, logo | partly superseded | design-system |
| [0016](0016-admin-settings.md) | Admin settings UI (`SettingsCatalog`) | active | [platform](../modules/platform.md) |
| [0017](0017-material-design-3.md) | Material Design 3 on PrimeNG | partly superseded by 0019, 0023, 0027 | design-system |
| [0018](0018-component-rules.md) | One look per component type | refined by 0019–0026 | design-system |
| [0019](0019-material-3-expressive.md) | M3 Expressive; button colour = meaning | refined by 0022, 0023, 0025, 0026 | design-system |
| [0020](0020-lists-in-cards.md) | Segmented lists in cards | active | design-system |
| [0021](0021-single-column.md) | One column; steady buttons; word wrapping | active | design-system |
| [0022](0022-expressive-fields-menus-sheets.md) | Fields, menus, split button, bottom sheet | active | design-system |
| [0023](0023-status-colors-and-contrast.md) | Status colours, warning role, contrast | active | design-system |
| [0024](0024-accessibility.md) | Accessibility | active | design-system |
| [0025](0025-page-states.md) | Page states: loading, error, empty, feedback | active | design-system |
| [0026](0026-decision-buttons-and-dialogs.md) | Decision buttons and dialogs | active | design-system |
| [0027](0027-bottom-navigation.md) | Bottom bar: four sections and «Ещё» | active | design-system |
| [0028](0028-excalidraw-boards.md) | Excalidraw boards: kinds, members, scenes, backups, React island | active (real time — 0029) | [boards](../modules/boards.md) |
| [0029](0029-live-boards.md) | Live boards: WebSocket with a one-time ticket, relayed cursors and elements | active | [boards](../modules/boards.md) |
| [0030](0030-livekit-calls.md) | Built-in video calls on LiveKit: own server, rooms `tb-<ownerId>`, tokens, link precedence | active | [meetings](../modules/meetings.md) |
| [0031](0031-split-variant-only.md) | Only the split variant: single container, `bundle-frontend` and backend SPA serving removed | active | README, [operations](../operations.md) |
| [0032](0032-ready-images-and-installer.md) | Ready GHCR images (amd64/arm64), `compose.yaml` without the repository, Caddy profile, `install.sh` and `teacherbox` | active | README, [operations](../operations.md) |
