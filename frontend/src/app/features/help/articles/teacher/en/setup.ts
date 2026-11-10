import { HelpArticleText } from '@features/help/help.models';

export const setupArticle: HelpArticleText = {
  title: 'Initial setup',
  summary: 'The first-sign-in wizard: your details, time and payment, lesson rules',
  body: `
Initial setup opens the first time you sign in. Every step already has a sensible default, so you can simply select “Next” each time. You can change \
everything later in Settings.

1. **Password:** this step appears only if the portal generated your first password, which was written to the server log. Choose your own; this step \
cannot be skipped.
2. **You and your portal:** enter the name students will see, and a photo if you like. The portal name appears in navigation, browser tabs, the \
sign-in page and the calendar. The portal address is the one students use to open it, such as https://school.example.com. Invitations, bot links and \
calendar subscriptions start with it. The portal fills in the address you are using now, and “Check” tells you whether it can be reached.
3. **Time and payment:** the time zone sets your schedule and monthly reports, and the portal suggests the one on your device. Then choose a \
currency, the usual lesson length and the default price for new students and groups. Individual prices can be changed later.
4. **Rules:** late cancellation, lesson reminders, the reminder before an assignment is due, and how many weeks of a repeating lesson appear ahead. \
An example next to each rule shows what it does.
5. **Done:** the portal suggests what to do next: add a student, connect a messaging app, the AI assistant or Google Calendar. “Go to the portal” \
opens your home page.

“Back” returns to the previous step. “Next” saves the step. “Skip” leaves the step’s values as they were and moves on. If a step cannot be saved, it \
stays open.

## Address warnings

- A localhost address works only on the computer running the portal.
- A home or office network address works only within that network. Students need an address they can reach over the internet.
- An HTTP address sends passwords without encryption. Ask the server administrator to enable HTTPS.

## Changing things later

- Name, logo and colours: “Settings” → “Portal”.
- Time zone, currency, price, lesson length and rules: “Settings” → “Lessons”.
- Your name and photo: “My account”.
- The public address: ask the portal administrator.

Messaging apps, the AI assistant and Google Calendar are not part of the wizard. Connect them in Settings, or from “Getting started” on your home \
page.
`,
};
