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

## Call controls

- **Microphone and camera:** turn either on or off. A red, crossed-out control means it is off.
- **Your preview:** in a two-person call, drag your camera preview to another corner. The portal remembers the position.
- **Share screen:** on a computer, share a window, browser tab or entire screen.
- **Settings:** change devices or adjust echo cancellation, noise suppression and automatic gain control. These are on by default; try turning them \
off if audio sounds clipped or muffled. Your choices are saved.
- **Connection details:** inspect each participant’s connection quality, protocol, ports, delay and audio loss. Share these details with the \
administrator when investigating poor audio.
- **Minimise:** keep the call in a small movable window while using boards, assignments or other portal pages. On a phone it becomes a bar above the \
bottom navigation. “Expand” restores the full window.
- **Leave call:** leave using the red button.

## External meeting links

An external link, such as Telemost or Zoom, takes precedence over the portal room. To use portal calls again, remove it from the student or group’s \
Profile tab under “Video meeting”. See [Video meetings](/teacher/help/meetings).

The administrator must configure the call server before portal calls are available.
`,
};
