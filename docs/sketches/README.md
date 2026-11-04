# Sketches

Copies of the design canvases that `docs/PLAN.md` points to, so the interface can be built from the
repository without access to the canvases. The canvas stays the source: when it changes, copy its
files here again in the same branch.

| Folder | Canvas | Boards |
|---|---|---|
| `settings/` | [«Настройки и аккаунт — эскизы»](https://claude.ai/artifact/L3wuTYeXnspJ9AGwHRD6kx) | 1–25 |
| `homework/` | [«Задания — эскизы»](https://claude.ai/artifact/X2SdNjSvCbgsnwwccToard) | 1–40 |

- `canvas.json` lists every board: its file, number and title (`boards.<file>.title`, «17. ИИ — …»)
  and its frame size. A plan item names a board by number and file, e.g. board 17
  `AiProviderDialog` is `settings/AiProviderDialog.dc.html`.
- A board is one `.dc.html` file: plain HTML and CSS inside `<x-dc>`, the sample data in the
  `renderVals()` script at the end. The files do not open on their own (they need the canvas
  runtime); read them as markup for layout, sizes, colours and wording.
- Build with the design tokens and the shared components in `docs/design-system.md`. Where a board
  goes against M3, M3 decides; where M3 allows both, the board wins.
- Left out of searches by `.ignore`; search with `rg --no-ignore <pattern> docs/sketches`.
