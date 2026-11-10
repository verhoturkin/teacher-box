# Settings (teacher)

`/teacher/settings[/:category]` (`features/settings/`: `settings.routes.ts`,
`settings-categories.ts`, `settings-page.ts`; boards `docs/sketches/settings/` 1–6, 10, 13, 14, 16,
17). List-detail with `medium="two"`; from expanded the bare address opens the account; on a phone
the account leads the list as its own row.

- **Rows show state, not contents** (messenger works, last backup, AI usage); until it loads, what
  the category holds. Messengers carry a badge of failed deliveries.
- **Saving:** every field saves on change ([design-system §9](../design-system.md), «Autosave»); the
  one exception is the portal category. Old addresses and `?open=` folds redirect in
  `settings.routes.ts` and `app.routes.ts`.

## Categories

- **Account:** the student's `AccountPanel` ([cabinet](cabinet.md#account)) plus the teacher's row
  for bot actions.
- **Portal** (board 2): the draft drives a light and a dark preview; from a 48 em container the
  first two cards stack left and the preview spans both rows (*ours*). The only explicit save: a row
  says what changed, and leaving asks. Branding: [design-system §15](../design-system.md).
- **Lessons** (`lesson-settings.ts`, board 3): two card columns, one below two 22 rem columns. The
  time-zone select shows region and current offset (*ours*: browsers have no localised zone names),
  the device's zone first. The currency locks once a charge or payment exists. Reminders are chips,
  longest first, at most three. Numbers save on leaving the field or Enter; a refused value returns
  to the saved one.
- **Students** (`identity/tags/tags-panel.ts`, ADR-0055, board 16): reorderable tags (drag or arrow
  keys); templates on the empty state create a tag with AI on. The tag dialog reads the students on
  open: the kind is locked on a tag a student has (409 `tag.kind-used` shows in the dialog); removed
  values are cleared for students and the snackbar says for how many. *Not built:* per-tag student
  counts (the API does not return them).
- **Messengers** (boards 4, 11): the failed-deliveries alert first (`failed-deliveries-card.ts`).
  One student's messengers are on the student card; «message everyone» is on Students.
- **AI** (`ai/ai-settings-panel.ts`, ADR-0057, board 5): each connection
  (`ai/ai-connections-card.ts`) is a segmented list of its models; one radio group across all
  connections marks the default model. A connection holding the default is deleted only when no
  other model could become the default (then the AI is turned off first); otherwise a snackbar asks
  to pick another default.
- **AI connection dialog** (`ai/ai-provider-dialog.ts`, board 17): step 1 — provider as selectable
  cards (*ours*: M3 publishes none), key, address (required for OpenAI-compatible), proxy; a failed
  check stays on step 1 with the provider's answer. Step 2 — the offered models (at most 50 rows,
  added ones disabled) and a manual id, open at once when the provider lists none. A saved
  connection opens at step 1 without the kind grid (a blank key keeps it) or at step 2.
- **Data** (board 6): backups (`settings/backups/`), Google Drive, restore and reset
  (`reset-card.ts`); both dangerous actions ask the password.

## First-run setup

`/teacher/setup` (`settings/setup/setup-page.ts`, ADR-0014; boards 20–25): a full-screen page
outside the shell. `setupGuard` (`core/portal/setup.guard.ts`) sends the teacher here while the
generated password is in force and leads the home page here until setup is done.

- **Frame:** from large three columns — stepper, form, examples (expanded puts the examples under
  the form). Compact and medium (board 25): one column with a linear progress and «next» in a pinned
  `tb-bottom-actions` bar.
- **Steps:** password (only while `passwordChangeRequired`) → you and the portal → time and payment
  → rules → done, built from the same per-setting field components as the categories (`tb-*-field`,
  mostly `settings/fields/`). Fields are prefilled with the saved value, the device's zone and the
  address the portal is open at.
- **Actions:** next saves only what changed; skip restores the saved values and moves on; back never
  returns to the password; a step that fails to save stays open.
- **Examples** (`setup-examples.ts`) follow the fields live; a later zone change keeps booked
  lessons, and the example says so.
- **Done:** next-step cards with live state; a card or «go to the portal» marks setup done; the
  saved values link back to their steps.
