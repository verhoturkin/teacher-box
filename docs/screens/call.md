# Call window

`features/meetings/call/`, ADR-0030; styles in «Built-in calls» of `styles.scss`.

- **Where:** `CallHost` sits in the root component above the routes, so a call goes on across
  layouts and the board editor; one call per tab (`CallSession`).
- **Pre-join** (`call-prejoin.ts`, `tb-dialog kind="form"`): camera preview (initials while the
  camera is off), microphone and camera toggles, device fields only when there are several; a note
  when the current call will end.
- **Full window** (`call-window.ts`): fixed over the page (`role="dialog"`, title focused, Esc
  closes an ended call; 421.2: no mini window). The stage (`call-layout.ts`): alone — own tile
  centred with a note; two — the other on the stage, own tile floating in a corner (`call-self.ts`;
  dragged or moved with arrows, remembered); three and more — a square grid (`gridSize`, at most two
  columns on a phone); a shared screen takes the stage with everyone in a strip. Own camera is
  mirrored, screens are not.
- **Toolbar** (`call-controls.ts`): the **M3E** floating toolbar; switched-off devices and an active
  share become **M3E** selected icon buttons (sizes M3 lacks are *ours*); `aria-pressed` on every
  toggle. No tooltips — they cover the video. The settings menu lies above the window; connection
  details (`call-stats-dialog.ts`) refresh every 2 s. No screen sharing on phones.
- **Chat** (`call-chat.ts`, 409.1): «Чат» in the toolbar opens an **M3** standard side sheet beside
  the stage (at most 400 dp; on a phone it covers the window — *ours*); the field takes the focus,
  the messages are a `role="log"`, own ones on secondary-container (*ours*). Unread messages show as
  an **M3** large badge (`tb-nav-badge`) on «Чат», and on «Вернуть во вкладку» of the floating
  window.
- **Picture-in-Picture** (`call-pip.ts`, 410.1): «Поверх других окон» in the toolbar, only where
  `documentPictureInPicture` exists and not on a phone, moves the whole window node with the
  portal styles to a 480 × 360 floating window (*ours*; 421.5, variant A): the video fills the
  window edge to edge (no rounding or padding; the own inset keeps its corners); the title (title
  small emphasized) and time on a 60 % black scrim strip over the top, the compact controls
  (microphone, camera, «Вернуть во вкладку», «Выйти» — the only red one) as separate round buttons
  on a scrim strip over the bottom, no toolbar pill. Both strips fade (effects spring, instant
  with reduced motion) when the pointer leaves the window or rests 3 s, and come back on pointer
  move, hover or keyboard focus; the crossed microphone on the tile stays. No «waiting» note, no
  chat and no tile menu (menus open in the tab); the window title is «<call> — <portal name>» (Chromium paints the
  portal origin above it — not changeable). Closing it brings the node back; the tab shows the
  portal meanwhile. Elsewhere (Firefox, Safari, phones) the call stays in the full window — the
  only fallback (421.2); the portal can be opened in another tab.
- **States:** connecting (`role="status"`), reconnecting (warning container), ended with its reason
  (`role="alert"`, close / rejoin); blocked sound — a message with «enable sound». Joins and leaves
  are announced in a polite live region.
