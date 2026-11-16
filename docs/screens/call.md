# Call window

`features/meetings/call/`, ADR-0030; styles in «Built-in calls» of `styles.scss`.

- **Where:** `CallHost` sits in the root component above the routes, so a call goes on across
  layouts and the board editor; one call per tab (`CallSession`).
- **Pre-join** (`call-prejoin.ts`, `tb-dialog kind="form"`): camera preview (initials while the
  camera is off), microphone and camera toggles, device fields only when there are several; a note
  when the current call will end.
- **Full window** (`call-window.ts`): fixed over the page (`role="dialog"`, title focused, Esc
  minimizes). The stage (`call-layout.ts`): alone — own tile centred with a note; two — the other on
  the stage, own tile floating in a corner (`call-self.ts`; dragged or moved with arrows,
  remembered); three and more — a square grid (`gridSize`, at most two columns on a phone); a shared
  screen takes the stage with everyone in a strip. Own camera is mirrored, screens are not.
- **Toolbar** (`call-controls.ts`): the **M3E** floating toolbar; switched-off devices and an active
  share become **M3E** selected icon buttons (sizes M3 lacks are *ours*); `aria-pressed` on every
  toggle. No tooltips — they cover the video. The settings menu lies above the window; connection
  details (`call-stats-dialog.ts`) refresh every 2 s. No screen sharing on phones.
- **Chat** (`call-chat.ts`, 409.1): «Чат» in the toolbar opens an **M3** standard side sheet beside
  the stage (at most 400 dp; on a phone it covers the window — *ours*); the field takes the focus,
  the messages are a `role="log"`, own ones on secondary-container (*ours*). Unread messages show as
  an **M3** large badge (`tb-nav-badge`) on «Чат», and on «Развернуть» of the mini window.
- **Picture-in-Picture** (`call-pip.ts`, 410.1): «Поверх других окон» in the toolbar, only where
  `documentPictureInPicture` exists and not on a phone, moves the whole window node with the
  portal styles to a 480 × 360 floating window (*ours*): no header, the compact controls with
  «Вернуть во вкладку», no chat and no tile menu (menus open in the tab). Closing it brings the
  node back; the tab shows the portal meanwhile.
- **Mini window** (`call-mini.ts`): on a computer a corner card dragged by its top line and snapped
  (or moved by a menu item; remembered) showing a shared screen, the speaker or a camera. On a phone
  a full-width pill above the bottom bar; the FAB moves above it.
- **States:** connecting (`role="status"`), reconnecting (warning container), ended with its reason
  (`role="alert"`, close / rejoin); blocked sound — a message with «enable sound». Joins and leaves
  are announced in a polite live region.
