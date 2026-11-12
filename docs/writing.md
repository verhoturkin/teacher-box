# Writing rules — languages, help, user docs

Moved from `AGENTS.md` §6.1 (stage 366.4); the rules are unchanged. Read before changing UI texts,
help
articles, bot or notification copy, `docs/wiki/` or any documentation language.

- English: code, identifiers, comments, commit messages, `AGENTS.md`/`CLAUDE.md` files,
  `docs/PLAN.md`, `docs/design-system.md`, `docs/screens.md`, `docs/modules/`, skills. Russian:
  README, `docs/operations.md`, `docs/glossary.md`, ADRs, CHANGELOG and the wiki. Product copy and
  help articles are authored in both Russian and English.
- **Write both languages together:** start from the same user intent and write idiomatic Russian and
  British English independently in the same change. Neither language is a prose source for the
  other. Preserve meaning, variables and action labels, not sentence structure. Read English on its
  own before finishing; avoid Russian calques. Follow `docs/glossary.md` for terminology across UI,
  help, bots, notifications and calendars. The Russian dictionary defines the key/type contract
  only; it does not dictate English wording.
- **Help is for users:** explain actions, outcomes, limits and troubleshooting. Leave layout
  geometry, visual tokens, component mechanics and implementation notes in developer docs, in every
  language. Mention technical details only when users need them to complete a task.
- **User docs are the GitHub wiki, kept in `docs/wiki/`** (Russian): install, update, backups,
  messengers, schedule, calls, boards, AI, proxy, FAQ. A change users see or must act on (install,
  the `teacherbox` command, settings, integrations, backups, operations) edits its
  `docs/wiki/<Page>.md` in the same branch and commit as the code; README stays slim and only links
  the wiki. CI publishes `docs/wiki/` to the wiki for every release (`scripts/publish-wiki.sh`;
  by hand — workflow `wiki.yml`), so the wiki shows the released version. Never edit the wiki on
  GitHub: the next release overwrites it. Page = file name without `.md`; links between pages are
  `[Text](Page)` (no `.md`), from other docs the full URL of the page under
  `github.com/verhoturkin/teacher-box/wiki` plus the page name; `verify.sh docs` checks both.
