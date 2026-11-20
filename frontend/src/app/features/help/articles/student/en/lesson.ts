import { HelpArticleText } from '@features/help/help.models';

export const lessonArticle: HelpArticleText = {
  title: 'Lessons and boards',
  summary: 'Join a lesson, use the call controls and open shared boards',
  body: `
## Join a lesson

Choose “Join lesson” on your home page or in the schedule. Your next lesson appears first on the home page, with its date, start time and duration. \
Shortly before it starts, the card shows a countdown; during the lesson, it shows the time remaining and a bar of the time passed. If your teacher \
is already in the portal call, the card says “Your teacher is waiting in the call”. Once a lesson has started, you cannot request \
to reschedule or cancel it.

For a portal call, check your camera and microphone in the preview, allow browser access when prompted, then choose “Join”. During the call you can:

- turn your microphone and camera on or off;
- drag your camera preview to another corner;
- choose “Chat” to message everyone in the call; the number on the button shows unread messages, and the chat isn’t saved after the call;
- choose “Float over other windows” in Chrome or Edge on a computer to keep talking in a small window above other tabs and apps \
while you use a board or work on an assignment; “Back to the tab” brings it back. In other browsers, open the portal in another tab;
- choose “Leave call” to leave.

If your teacher uses an external video service, such as Telemost, the lesson link opens that service in a new tab.

## Open a board

Open “Materials” → “Boards” to see boards shared with you or your group. Search by title or filter by “All”, “In the portal” or “External”. The next \
lesson card also links directly to its boards.

An **Excalidraw board** opens in the portal. You and your teacher can draw together and see each other’s cursors. Changes are saved automatically. \
The status at the top shows “Saved”, “Saving…” or “Offline — reconnecting…”. Images appear as they load, so you can start drawing straight away.

The board menu (☰) contains the theme, grid and mouse-wheel settings. Choose “Zoom” or “Scroll (touchpad)” to suit your device. Use “Back” to return \
to where you opened the board, or “Back to boards” if you followed a direct link. These actions are also in the board menu.

To save reusable shapes, select them, right-click and choose “Add to library”. Open your library with the button at the top right.

An **external board**, such as Holst, opens in a new tab. The bot also provides “Join lesson” and “My boards” links.
`,
};
