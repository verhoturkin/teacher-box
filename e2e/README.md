# Browser regression suites

Tests are organized by functionality, not by the release that introduced a regression.
Add new checks to the relevant suite; retain cross-module workflows in `journeys/`.

## Running

From the repository root (Git Bash on Windows):

```bash
./scripts/verify.sh e2e                      # TypeScript only
./scripts/e2e.sh                            # all scenarios on a disposable instance
./scripts/e2e.sh tests/materials             # one functional area
./scripts/e2e.sh --project=operations --no-deps # only reset/restore/restart
```

Use `E2E_BROWSER_CHANNEL=chrome` for installed Chrome. New tests can change the scenario count.
The CI workflow runs the full browser suite; `verify.sh e2e` only checks types.

## Boundaries and setup

- `identity/`, `schedule/`, `homework/`, `billing/`, `materials/`, `meetings/`,
  `notifications/`, `ai/`, `settings/` and `admin/` own their functional regressions.
- `layout/` and `accessibility/` cover shared browser rendering, geometry, keyboard and contrast.
  These checks need a real browser even when their API data is stubbed.
- `journeys/` keeps cross-module teacher/student workflows and their shared preparation together.
- `support/session.ts` creates a fresh API session in the browser's own cookie jar; the application
  restores its in-memory access token through the refresh cookie. Do not reuse rotated cookies across
  tests. Authentication and language-selection journeys still enter credentials through the UI.
- `support/create.ts` and `support/this-week.ts` hold common UI/data preparation.
- Bot setup clears its own prior configuration/link before exercising the wizard. The off-time
  scenario selects an otherwise free day through the student's busy-time API, so removing its own
  block proves availability without colliding with another suite's lessons.
- `operations/` resets/restores data or restarts the application. Its separate Playwright project
  depends on `chromium`, so these operations start only after the ordinary suites pass. It uses the
  same disposable instance, not an independent database. Keep one worker until global setting mutations
  and the existing serial journeys are isolated. File grouping alone does not make them parallel-safe.
  Restore selects the backup named by the creation response, never an existing first row in the list.

## Further test cleanup

Delete an assertion only after identifying the retained test that protects the same behaviour. Similar
names alone are insufficient: board polling and WebSocket delivery cover different integration paths.
API-only deployment checks still verify the packaged application and should not be discarded merely
because backend tests cover the underlying business rule.

The shared homework review controller now owns normalization and request state; its existing component
tests still protect surface-specific AI insertion, queue advancement and compact validation. Further
consolidation should move common cases to the controller while retaining those interactions. Backend
record-accessor and factory assertions in `ChatSpiTest` remain candidates, not proven redundant tests;
do not remove validation, immutable-state or default-SPI behaviour just to reduce the test count.

## Migration map

All 214 collected scenarios were retained during the refactor. Existing serial chains and per-suite
preparation remain together. The map records provenance; future regressions belong to their functional
suite rather than extending this table. Mixed scenarios remain intact to avoid duplicating their setup.

| Previous file in `tests/` | Functional suite in `tests/` |
|---|---|
| `admin.spec.ts` | [admin/diagnostics.spec.ts](tests/admin/diagnostics.spec.ts) |
| `messengers.spec.ts` | [notifications/bot-setup.spec.ts](tests/notifications/bot-setup.spec.ts) |
| `teacher-and-student.spec.ts` | [journeys/teacher-and-student.spec.ts](tests/journeys/teacher-and-student.spec.ts) |
| `version-0-10-0.spec.ts` | [materials/textbook-pages.spec.ts](tests/materials/textbook-pages.spec.ts) |
| `version-0-10-1.spec.ts` | [layout/schedule-drag-and-navigation.spec.ts](tests/layout/schedule-drag-and-navigation.spec.ts) |
| `version-0-10-2.spec.ts` | [notifications/inbox.spec.ts](tests/notifications/inbox.spec.ts) |
| `version-0-10-3.spec.ts` | [materials/board-image-concurrency.spec.ts](tests/materials/board-image-concurrency.spec.ts) |
| `version-0-10-4.spec.ts` | [materials/board-image-preload.spec.ts](tests/materials/board-image-preload.spec.ts) |
| `version-0-11-0.spec.ts` | [journeys/language-and-authoring.spec.ts](tests/journeys/language-and-authoring.spec.ts) |
| `version-0-11-1.spec.ts` | [identity/account-language.spec.ts](tests/identity/account-language.spec.ts) |
| `version-0-12-0.spec.ts` | [settings/drive-and-board-backups.spec.ts](tests/settings/drive-and-board-backups.spec.ts) |
| `version-0-13-0.spec.ts` | [billing/receipts-and-default-topic.spec.ts](tests/billing/receipts-and-default-topic.spec.ts) |
| `version-0-13-1.spec.ts` | [identity/sign-in-persistence.spec.ts](tests/identity/sign-in-persistence.spec.ts) |
| `version-0-14-7.spec.ts` | [ai/prompts-and-request-log.spec.ts](tests/ai/prompts-and-request-log.spec.ts) |
| `version-0-15-0.spec.ts` | [journeys/teacher-home-and-filters.spec.ts](tests/journeys/teacher-home-and-filters.spec.ts) |
| `version-0-15-1.spec.ts` | [journeys/student-home-and-account.spec.ts](tests/journeys/student-home-and-account.spec.ts) |
| `version-0-15-2.spec.ts` | [notifications/badge-and-task-layout.spec.ts](tests/notifications/badge-and-task-layout.spec.ts) |
| `version-0-15-3.spec.ts` | [journeys/home-materials-and-agenda.spec.ts](tests/journeys/home-materials-and-agenda.spec.ts) |
| `version-0-15-4.spec.ts` | [notifications/responsive-actions-and-board-filter.spec.ts](tests/notifications/responsive-actions-and-board-filter.spec.ts) |
| `version-0-16-0.spec.ts` | [layout/loading-and-colour-swatches.spec.ts](tests/layout/loading-and-colour-swatches.spec.ts) |
| `version-0-16-1.spec.ts` | [layout/button-shapes.spec.ts](tests/layout/button-shapes.spec.ts) |
| `version-0-16-2.spec.ts` | [layout/list-dialog-and-navigation-tokens.spec.ts](tests/layout/list-dialog-and-navigation-tokens.spec.ts) |
| `version-0-16-3.spec.ts` | [layout/navigation-and-motion.spec.ts](tests/layout/navigation-and-motion.spec.ts) |
| `version-0-17-0.spec.ts` | [layout/action-colours.spec.ts](tests/layout/action-colours.spec.ts) |
| `version-0-17-1.spec.ts` | [layout/lesson-action-sizes.spec.ts](tests/layout/lesson-action-sizes.spec.ts) |
| `version-0-17-2.spec.ts` | [layout/material-symbols.spec.ts](tests/layout/material-symbols.spec.ts) |
| `version-0-17-3.spec.ts` | [layout/search-icon.spec.ts](tests/layout/search-icon.spec.ts) |
| `version-0-18-0.spec.ts` | [settings/backup-retention.spec.ts](tests/settings/backup-retention.spec.ts) |
| `version-0-18-1.spec.ts` | [layout/chips-drag-and-message-composer.spec.ts](tests/layout/chips-drag-and-message-composer.spec.ts) |
| `version-0-19-0.spec.ts` | [homework/video-and-transcript.spec.ts](tests/homework/video-and-transcript.spec.ts) |
| `version-0-19-1.spec.ts` | [homework/caption-language.spec.ts](tests/homework/caption-language.spec.ts) |
| `version-0-2.spec.ts` | [journeys/groups-and-messengers.spec.ts](tests/journeys/groups-and-messengers.spec.ts) |
| `version-0-20-0.spec.ts` | [identity/student-and-group-colours.spec.ts](tests/identity/student-and-group-colours.spec.ts) |
| `version-0-20-1.spec.ts` | [identity/avatar-colour.spec.ts](tests/identity/avatar-colour.spec.ts) |
| `version-0-21-0.spec.ts` | [layout/create-menu-and-help-panes.spec.ts](tests/layout/create-menu-and-help-panes.spec.ts) |
| `version-0-22-0.spec.ts` | [settings/categories-and-notification-pane.spec.ts](tests/settings/categories-and-notification-pane.spec.ts) |
| `version-0-23-0.spec.ts` | [identity/student-and-group-cards.spec.ts](tests/identity/student-and-group-cards.spec.ts) |
| `version-0-24-0.spec.ts` | [schedule/lesson-queue.spec.ts](tests/schedule/lesson-queue.spec.ts) |
| `version-0-24-1.spec.ts` | [layout/brand-home-and-tabs.spec.ts](tests/layout/brand-home-and-tabs.spec.ts) |
| `version-0-25-0.spec.ts` | [homework/review-queue-and-journal.spec.ts](tests/homework/review-queue-and-journal.spec.ts) |
| `version-0-26-0.spec.ts` | [materials/feed-and-global-search.spec.ts](tests/materials/feed-and-global-search.spec.ts) |
| `version-0-27-0.spec.ts` | [journeys/student-and-admin-panes.spec.ts](tests/journeys/student-and-admin-panes.spec.ts) |
| `version-0-28-0.spec.ts` | [layout/toolbar-and-pane-sizing.spec.ts](tests/layout/toolbar-and-pane-sizing.spec.ts) |
| `version-0-29-0.spec.ts` | [journeys/authoring-repeats-and-materials.spec.ts](tests/journeys/authoring-repeats-and-materials.spec.ts) |
| `version-0-3.spec.ts` | [operations/reset-and-restore.spec.ts](tests/operations/reset-and-restore.spec.ts) |
| `version-0-30-0.spec.ts` | [layout/assignment-and-list-controls.spec.ts](tests/layout/assignment-and-list-controls.spec.ts) |
| `version-0-4.spec.ts` | [layout/responsive-branding.spec.ts](tests/layout/responsive-branding.spec.ts) |
| `version-0-5-3.spec.ts` | [schedule/groups-and-unavailable-time.spec.ts](tests/schedule/groups-and-unavailable-time.spec.ts) |
| `version-0-5.spec.ts` | [operations/settings-and-restart.spec.ts](tests/operations/settings-and-restart.spec.ts) |
| `version-0-6-10.spec.ts` | [layout/fields-and-lesson-actions.spec.ts](tests/layout/fields-and-lesson-actions.spec.ts) |
| `version-0-6-11.spec.ts` | [accessibility/forms-focus-and-contrast.spec.ts](tests/accessibility/forms-focus-and-contrast.spec.ts) |
| `version-0-6-12.spec.ts` | [layout/buttons-and-fallback-page.spec.ts](tests/layout/buttons-and-fallback-page.spec.ts) |
| `version-0-6-13.spec.ts` | [layout/bell-and-switch.spec.ts](tests/layout/bell-and-switch.spec.ts) |
| `version-0-6-5.spec.ts` | [layout/page-actions-and-overflow.spec.ts](tests/layout/page-actions-and-overflow.spec.ts) |
| `version-0-6-6.spec.ts` | [layout/dialogs-and-notifications.spec.ts](tests/layout/dialogs-and-notifications.spec.ts) |
| `version-0-6-7.spec.ts` | [layout/list-rows.spec.ts](tests/layout/list-rows.spec.ts) |
| `version-0-6-8.spec.ts` | [layout/schedule-and-student-panes.spec.ts](tests/layout/schedule-and-student-panes.spec.ts) |
| `version-0-6-9.spec.ts` | [layout/help-navigation.spec.ts](tests/layout/help-navigation.spec.ts) |
| `version-0-6.spec.ts` | [layout/adaptive-navigation.spec.ts](tests/layout/adaptive-navigation.spec.ts) |
| `version-0-7-1.spec.ts` | [materials/board-library.spec.ts](tests/materials/board-library.spec.ts) |
| `version-0-7-2.spec.ts` | [materials/board-collaboration.spec.ts](tests/materials/board-collaboration.spec.ts) |
| `version-0-7.spec.ts` | [materials/board-lifecycle.spec.ts](tests/materials/board-lifecycle.spec.ts) |
| `version-0-8-0.spec.ts` | [meetings/teacher-and-student.spec.ts](tests/meetings/teacher-and-student.spec.ts) |
| `version-0-8-1.spec.ts` | [meetings/call-controls.spec.ts](tests/meetings/call-controls.spec.ts) |
| `version-0-9-0.spec.ts` | [admin/deployment.spec.ts](tests/admin/deployment.spec.ts) |
| `version-0-9-1.spec.ts` | [identity/profile-and-mobile-settings.spec.ts](tests/identity/profile-and-mobile-settings.spec.ts) |
| `version-0-9-2.spec.ts` | [settings/account-and-categories.spec.ts](tests/settings/account-and-categories.spec.ts) |
| `version-0-9-3.spec.ts` | [layout/journals-and-materials.spec.ts](tests/layout/journals-and-materials.spec.ts) |
