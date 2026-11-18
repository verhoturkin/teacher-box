import { HelpArticleText } from '@features/help/help.models';

export const callsArticle: HelpArticleText = {
  title: 'Calls',
  summary: 'Run video lessons in the portal with permanent student and group rooms',
  body: `
Each student and group has a permanent call room. Calls run in the browser without installing an app. Check availability under “Settings” → “Lessons” \
→ “Calls”; room links appear in student and group details.

## Join a call

Choose “Start lesson”, follow a room link or open a reminder. In the preview, check your camera and microphone, choose devices or turn them off, then \
select “Join”. Allow camera and microphone access when your browser asks.

## Call in a student

If a lesson has started and a student hasn’t joined the call, their lesson row on the home page shows “… hasn’t joined the call yet” with “Call in” \
(“Call in the rest” for a group). The student gets a notification in their account and messengers with a button to join. You can call in the same \
student once every three minutes. Lessons with an external link have no button, as the portal can’t tell who is in the call.

## Call controls

- **Microphone and camera:** turn either on or off. A red, crossed-out control means it is off.
- **Your preview:** in a two-person call, drag your camera preview to another corner. The portal remembers the position.
- **Share screen:** on a computer, share a window, browser tab or entire screen.
- **Settings:** change devices or adjust echo cancellation, noise suppression and automatic gain control. These are on by default; try turning them \
off if audio sounds clipped or muffled. Your choices are saved.
- **Connection details:** inspect each participant’s connection quality, protocol, ports, delay and audio loss. Share these details with the \
administrator when investigating poor audio.
- **Moderate:** on another participant’s tile, open the “⋮” menu. “Turn off microphone” mutes them (they can turn it on again); \
“Remove from call” asks for confirmation, \
then the person sees why the call ended and can rejoin.
- **Student’s board:** in the call “Settings” menu, pick a participant: their boards open in a new tab and the call carries on.
- **Chat:** message everyone in the call; the number on the button shows unread messages. Only people in the call see the chat, and it isn’t saved after the call.
- **Float over other windows:** in Chrome and Edge on a computer, the call moves to a small window above other tabs and apps, with the call name, tiles, microphone, camera and Leave call, \
so you can use boards, assignments or other portal pages. “Back to the tab” or closing that window brings the call back to the portal. \
In other browsers and on a phone, the call stays in the full window; open the portal in another tab to work alongside it.
- **Leave call:** leave using the red button.

## External meeting links

An external link, such as Telemost or Zoom, takes precedence over the portal room. To use portal calls again, remove it from the student or group’s \
Profile tab under “Video meeting”. See [Video meetings](/teacher/help/meetings).

The administrator must configure the call server before portal calls are available.
`,
};
