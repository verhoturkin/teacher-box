import { HelpArticleText } from '@features/help/help.models';

export const appearanceArticle: HelpArticleText = {
  title: 'Appearance, language and mobile use',
  summary: 'Choose your portal’s appearance and use it comfortably on any device',
  body: `
## Portal branding

Open “Settings” → “Portal” to change the name, logo and colour; scheme and contrast are under “Fine tuning”. Save from the row that appears under the \
colour choice. Preview shows your choices before saving; on a wide screen it appears beside the settings.

- **Colour:** choose a base colour or “Custom colour”. Use the swatch to open the colour picker, or enter a HEX code such as #0f766e. Buttons, links \
and highlights use shades of this colour. The portal adjusts shades for readable contrast and warns if a colour needs a large adjustment or resembles \
delete buttons.
- **Colour scheme:** choose a style from the gallery, from Original to Monochrome.
- **Contrast:** choose Lower, Standard, Higher or Maximum. Text remains readable at every level.
- **Preview:** see the light and dark themes side by side. Save applies the appearance to everyone; Discard restores the saved values.
- **Logo:** upload a PNG, JPEG, WebP or SVG up to 1 MB. It appears in navigation, on sign-in and in the browser tab. Use the bin to restore the \
default icon. Logo changes apply immediately.

## Personal theme and language

Select your name → “Appearance” to choose Light, Dark or System. This preference is saved on your device; each student chooses their own theme.

Choose Русский or English in the same section. The portal reloads in that language and saves the choice on the device and account. Language buttons \
are also below the sign-in and invitation cards.

New notifications, bot replies and calendar subscriptions use the recipient’s language. Existing notifications keep their original text. Student \
names, topics and messages remain as entered.

## Use the portal on your phone

The portal works in the browser. In Chrome on Android, choose the browser menu → “Add to Home screen” → “Install” to open it in its own window with \
your name and logo. Android may take time to refresh app colours after a theme change.

On a phone, use the bottom navigation for Home, Schedule, Homework, Students and Payments. Open ☰ for Materials, Settings and Help. The current \
section is highlighted. On larger screens, sections appear in a sidebar, with Create near the top and Settings and Help near the bottom.

The main action, such as “Add student” or “New assignment”, appears at the bottom right on phones. Forms with several fields open full screen with \
Save or Create at the top. Lesson details open in a bottom panel and confirmations in a dialog. Use the back arrow on detail pages to return to the \
list.

## Find things quickly

Use the search at the top to find students, groups, assignments, boards and textbooks. It searches lists already loaded in this session and groups \
matching results. Use ↑ and ↓ to select a result, Enter to open it and Esc to close search. Ctrl+K, or ⌘+K on a Mac, opens search from any page. On a \
phone, use the magnifying glass.

The bell opens notifications. Help is available through ? beside page or section headings, or under ☰ on a phone.

## Forms and keyboard access

Field labels remain visible while you type. Required fields have an asterisk. If a value is invalid, the portal explains below the field and focuses \
the first error when you save. Closing an edited form asks “Discard changes?”: choose Discard to leave or Cancel to keep editing.

If content fails to load, choose Retry. Confirmation dialogs explain the action before you commit it; red buttons are used for deletion. Cancel \
closes a dialog without applying its action.

Use Tab to move through controls and Esc to close dialogs and panels. A visible focus outline shows where you are, and focus returns to the control \
that opened a dialog. Browser text-size settings enlarge the text.
`,
};
