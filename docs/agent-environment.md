# Agent environment

Details moved out of `AGENTS.md` (stage 387.1, chain step 353.1) so that every session loads less;
the rules are unchanged. Read the section you need: `grep -n '^##' docs/agent-environment.md`.

## Repository layout

```
docs/          PLAN.md, design-system.md, screens.md, glossary.md, writing.md, operations.md, modules/, adr/, archive/, wiki/, sketches/
backend/       Spring Boot app — src/main/java/ru/teacherbox/{shared,platform,<modules>}
frontend/      Angular app — src/app/{core,shared,features/<module>}
docker/        Dockerfile (targets backend, frontend), nginx
compose.yaml   ready GHCR images;  compose.build.yaml — override that builds from the source
e2e/           Playwright tests against a running instance
scripts/       verify.sh (all checks = pre-commit = CI), e2e.sh, agent-setup.sh, check-agents.sh, publish-wiki.sh
.env.example   every TEACHERBOX_* variable;  .githooks/pre-commit;  .github/workflows/
```

Deployment: Docker Compose — nginx + backend (ADR-0031), images in GHCR (ADR-0032).

## Rarely needed reading

| Task | Read |
|---|---|
| History of the 2026-10 redesign (stages 229–249) | [`archive/redesign-2026-10/README.md`](archive/redesign-2026-10/README.md) — only for history |
| Running the product | `README.md`, [`operations.md`](operations.md), `docs/wiki/` (the [wiki](https://github.com/verhoturkin/teacher-box/wiki), Russian) |

## Commands

```bash
./scripts/verify.sh                    # all checks (= pre-commit = CI); full logs in .verify-logs/
./scripts/verify.sh backend|frontend   # one part
./scripts/verify.sh e2e                # the E2E tests compile
./scripts/verify.sh docs               # wiki links, agent configs in sync, stamp test
./scripts/verify.sh docker             # compose files, image build, nginx config + installer
./scripts/verify.sh installer          # only shellcheck of scripts/ and the dry run of install.sh
cd backend && ./mvnw clean verify      # tests + JaCoCo gates + Modulith verify
cd backend && ./mvnw spring-boot:run   # API :8080, data in ./backend/data
cd frontend && npx -y npm@11 ci        # npm >= 11 (ADR-0007)
cd frontend && npm run lint && npm test && npm run build
cd frontend && npm start               # :4200, proxy /api -> :8080
./scripts/e2e.sh                       # Playwright, fresh instance (:8091); locally E2E_BROWSER_CHANNEL=chrome
docker compose -f compose.yaml -f compose.build.yaml up -d --build   # build from the source
```

### Verify stamps and the pre-commit hook

A part that passes writes `.verify-logs/<part>.ok` (the tree it checked); a part with a skipped
check leaves no stamp. The pre-commit hook (`verify.sh staged <part>`) checks the content of the
commit: it skips a part stamped for exactly the index tree, runs it in place when the working tree
equals the index, else on a temporary export of the index (slower: `git add -p`, unstaged edits and
untracked files cost a run). So stage everything, then run `verify.sh <part>` after the final edit.

## Local environment

- Windows 11, PowerShell 5.1 (no `&&` — use `;` and `if ($?)`); Git Bash for `*.sh`; `mvnw.cmd`.
- JDK 25, Maven 3.9 (use `mvnw`), Node 22, npm 10 (install with `npx -y npm@11 ci|install` —
  ADR-0007), Docker (daemon may be down — check `docker info`).
- Files: UTF-8 no BOM, LF.

## Cloud environment

Linux container; setup script `scripts/agent-setup.sh` — hooks path, `npm ci` in `frontend/`,
`e2e/`.

- No JDK 25, no Docker daemon, no E2E runs. Run what works (`./scripts/verify.sh
  frontend|docs|e2e`, shellcheck when available); say in the reply and the PR what was not run and
  why; never claim an unrun check green. Backend is verified by CI on the pull request; never weaken
  a check to get green.
