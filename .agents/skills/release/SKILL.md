---
name: release
description: Finish a Teacher Box release — help articles, E2E spec, CHANGELOG, version bump, plan archiving. Use for the last stage of a release in docs/PLAN.md ("Выпуск X.Y.Z" / "Release X.Y.Z") or when asked to cut a version.
---

# Release X.Y.Z

Do it as the last stage of the release section in `docs/PLAN.md`, in one commit
`chore(release): X.Y.Z` (or as the plan's substeps say).

1. **Help and user docs** (user-facing):
   - Help articles, every language — `frontend/src/app/features/help/articles/{teacher,student,admin}/{ru,en}/<topic>.ts`:
     describe every user-visible change of the release; wording per `docs/glossary.md`.
   - **Wiki** (`docs/wiki/`, Russian) — check that the release's substeps updated every page they change for
     users: install, update, the `teacherbox` command, settings (`TEACHERBOX_*` with defaults), integrations,
     backups, features, FAQ; fill the gaps and remove notes the release makes obsolete
     (`git diff vPREV -- docs/wiki` shows what changed). CI publishes it with the release
     (step 7).
   - README only if the basics or its links change (it stays slim and links the wiki); `docs/operations.md` if
     operations changed.
2. **E2E** — extend the relevant functional suites under `e2e/tests/` (see `e2e/README.md`), reusing
   `tests/support` helpers. Keep cross-module journeys intact and reset/restore/restart in `operations/`;
   do not create version-specific specs. Compile check: `./scripts/verify.sh e2e`;
   full run `./scripts/e2e.sh` (needs Docker).
3. **CHANGELOG.md** (Russian, Keep a Changelog): new `## [X.Y.Z] — YYYY-MM-DD` at the top with «Добавлено» /
   «Изменено» / «Исправлено». Read only the top entry for the format — not the whole file. The file
   keeps the releases of the current minor series and the previous one; when a release starts a new
   minor series, move the older entries to `docs/archive/changelog/<year>.md` (by release year,
   newest first); the link stays at the bottom of `CHANGELOG.md`. SemVer: data or settings
   incompatibility → MAJOR, features → MINOR, fixes → PATCH.
4. **Version** — `backend/pom.xml` `<version>`, `frontend/package.json` `version` and the root entries of
   `frontend/package-lock.json` (run `npx -y npm@11 install --package-lock-only` in `frontend/`).
5. **Plan** — tick the stage; move the whole release section from `docs/PLAN.md` to
   `docs/archive/plans/vX.Y.Z.md` (heading `# vX.Y.Z — plan archive (stages N–M)`), add a row to
   `docs/archive/plans/README.md`, move unfinished items to Backlog.
6. **Verify** — `./scripts/verify.sh` (backend, frontend, docker, e2e compile) green before
   committing; `./scripts/release-version.sh` prints `version=X.Y.Z`, `release=true` (one version
   everywhere, the CHANGELOG section found).
7. **No tag** (ADR-0063) — push the branch and open the PR as usual; never create or push `vX.Y.Z`.
   The PR's job «Release version» repeats the check of step 6. Merging the PR into `main` **is** the
   release: that CI run publishes the images, then tags the `main` commit `vX.Y.Z`, creates the
   GitHub release from the CHANGELOG section and publishes `docs/wiki/`. So the version is bumped
   only in the release commit, never in other branches.
8. **After the merge** — check the `main` run: jobs «Tag and GitHub release» and «Publish the wiki»
   passed, the release is on GitHub. A failed release has no tag: fix it with «Re-run failed jobs»
   (or the next merge to `main`, which releases the same version). Republish the wiki by hand —
   workflow `wiki.yml` on the tag.
