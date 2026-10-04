---
name: release
description: Finish a Teacher Box release — help articles, E2E spec, CHANGELOG, version bump, plan archiving. Use for the last stage of a release in docs/PLAN.md ("Выпуск X.Y.Z" / "Release X.Y.Z") or when asked to cut a version.
---

# Release X.Y.Z

Do it as the last stage of the release section in `docs/PLAN.md`, in one commit
`chore(release): X.Y.Z` (or as the plan's substeps say).

1. **Help** (Russian, user-facing) — `frontend/src/app/features/help/articles/{teacher,student,admin}.ts`:
   describe every user-visible change of the release; wording per `docs/glossary.md`. README if install,
   settings or integrations changed; `docs/operations.md` if operations changed.
2. **E2E** — add `e2e/tests/version-X-Y-Z.spec.ts` (dashes) covering the release's scenarios; reuse helpers
   from existing specs. Compile check: `./scripts/verify.sh e2e`; full run `./scripts/e2e.sh` (needs Docker).
3. **CHANGELOG.md** (Russian, Keep a Changelog): new `## [X.Y.Z] — YYYY-MM-DD` at the top with «Добавлено» /
   «Изменено» / «Исправлено». Read only the top entry for the format — not the whole file. SemVer: data or
   settings incompatibility → MAJOR, features → MINOR, fixes → PATCH.
4. **Version** — `backend/pom.xml` `<version>`, `frontend/package.json` `version` and the root entries of
   `frontend/package-lock.json` (run `npx -y npm@11 install --package-lock-only` in `frontend/`).
5. **Plan** — tick the stage; move the whole release section from `docs/PLAN.md` to
   `docs/archive/plans/vX.Y.Z.md` (heading `# vX.Y.Z — plan archive (stages N–M)`), add a row to
   `docs/archive/plans/README.md`, move unfinished items to Backlog.
6. **Verify** — `./scripts/verify.sh` (backend, frontend, docker, e2e compile) green before committing.
7. Tag `vX.Y.Z` only when the user asks (tags are pushed by the user/CI).
