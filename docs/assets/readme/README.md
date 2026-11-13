# README screenshot gallery

These are real Chromium screenshots of Teacher Box 0.48.1, in Russian, with fictional data.
Desktop captures use 1440 × 1000; phone captures use 390 × 844. The browser uses light mode,
Europe/Moscow time and reduced motion. Dates are relative to the capture day.

## Recreate the gallery

Use an **empty disposable local instance**. The script creates accounts, lessons, homework,
payments, boards, original sample PDFs, a quiz, saved AI prompts and a backup through the public
application API. It refuses to seed an instance with existing students or a remote hostname.
No messenger or AI provider credentials are needed; no external messages or model calls are made.

1. Install frontend and E2E dependencies as described in `docs/agent-environment.md`.
   Install Chromium or set `CHROMIUM_PATH` to an existing Chrome/Chromium executable.
2. Build the backend with JDK 25: `cd backend && ./mvnw -DskipTests package`.
3. From the repository root, start the backend in a separate terminal:

   ```bash
   demo_data_dir="$(mktemp -d)"
   TEACHERBOX_DATA_DIR="$demo_data_dir" \
   TEACHERBOX_IDENTITY_TEACHER_PASSWORD=readme-demo-pass \
   java -jar backend/target/teacher-box.jar
   ```

4. Start the frontend in another terminal: `cd frontend && npm start`.
5. From the repository root, run `node scripts/readme-screenshots.mjs`.

The script completes the initial setup, seeds the data, captures all screens and checks the
rendered routes and browser errors. Review every image and update the version in `README.md`.
Do not commit the demo database, backup archives or credentials for a real account.

## Recapture

While that same demo instance is running, use:

```bash
DEMO_CAPTURE_ONLY=1 node scripts/readme-screenshots.mjs
DEMO_CAPTURE_ONLY=1 DEMO_SCREENS=home,schedule node scripts/readme-screenshots.mjs
```

Fixture IDs are kept in `/tmp/teacherbox-readme-state.json`. The review and board editor are
always refreshed, including when `DEMO_SCREENS` selects only some pages. The review screenshot
shows an unsent comment and grade; capturing it does not accept the student's work.
The quiz capture opens an attempt and selects an answer, without submitting the test.

`DEMO_BASE_URL` changes the frontend address (default `http://localhost:4200`);
`DEMO_PASSWORD` changes the common demo password and must match the backend bootstrap password.


## Video calls

`scripts/readme-calls.mjs` adds four screenshots: prejoin, an individual call, a group call with
three participants, and a minimized call over the board. It uses the existing demo accounts and
IDs from the main capture script. Install FFmpeg (including its SVG decoder) and LiveKit 1.13.7
from the official LiveKit release before running it.

Start the local LiveKit server with this configuration, saved as `/tmp/readme-livekit.yaml`:

```yaml
port: 7880
bind_addresses: [127.0.0.1]
rtc:
  node_ip: 127.0.0.1
  use_external_ip: false
  enable_loopback_candidate: true
  tcp_port: 7881
  udp_port: 7882
keys:
  readme: readme-livekit-secret-0123456789abcdef
logging:
  level: info
```

```bash
livekit-server --config /tmp/readme-livekit.yaml
```

In the same terminal used for the demo backend, stop it and restart with calls enabled, retaining
its data directory:

```bash
TEACHERBOX_DATA_DIR="$demo_data_dir" \
TEACHERBOX_IDENTITY_TEACHER_PASSWORD=readme-demo-pass \
TEACHERBOX_MEETINGS_LIVEKIT_API_URL=http://localhost:7880 \
TEACHERBOX_MEETINGS_LIVEKIT_API_KEY=readme \
TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET=readme-livekit-secret-0123456789abcdef \
java -jar backend/target/teacher-box.jar
```

Keep the frontend running; its existing proxy forwards `/livekit` to the local server. Then run:

```bash
node scripts/readme-calls.mjs
```

These credentials are public fixtures for a loopback-only disposable server. The script builds
three original notebook videos in a temporary directory and supplies them to Chromium's test
camera. Each participant uses a separate browser, a real account and an actual LiveKit WebRTC
connection. It verifies participant counts and decoded video before capturing. The script leaves
all calls, closes its browsers and removes the temporary media files on exit.
