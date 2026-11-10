import { HelpArticleText } from '@features/help/help.models';

export const boardsArticle: HelpArticleText = {
  title: 'Boards',
  summary: 'Create shared boards, draw together and add lesson materials',
  body: `
Open “Materials” → “Boards” to see your boards. Search by title, student or group, filter by “All”, “In the portal” or “External”, and change the \
sort order.

- **Excalidraw boards** run in the portal, support live collaboration and save automatically.
- **External boards**, such as [Holst](https://app.holst.so), are links to another service and open in a new tab.

## Create and share a board

1. Choose “Create” → “Board”, or “Materials” → “New board” on a phone.
2. Choose a type and enter a title. For an external board, paste its link and enable link sharing in that service.
3. Select students and groups. Remove a selection chip to revoke that selection. All current group members can access a shared group board; students \
who leave the group lose that access.

Board cards show a preview, title, recipients and last update. Select a card to open it. Use its ⋮ menu to edit or delete it. Deleting an Excalidraw \
board also deletes its content, images and board backups. Lesson cards link to the relevant student or group’s boards.

## Draw together

An Excalidraw board opens full screen. Participants see each other’s drawings, cursors and names live. If two people edit the same shape, the latest \
change wins. Images load gradually so you can start drawing immediately.

The top status shows “Saved”, “Saving…” or “Offline — reconnecting…”. If the live connection drops, the portal retries and checks for changes \
periodically.

The board menu (☰) contains:

- **Theme:** Light, Dark or System, shared with the portal theme setting;
- **Grid:** visible to everyone on this board;
- **Mouse wheel:** Zoom, or Scroll (touchpad). In scroll mode, pinch or use Ctrl to zoom. This preference is saved on your device.

Use “Back” to return to the page you came from, or “Back to boards” after opening a direct link. The portal waits for unsaved changes and the preview \
to be saved before returning. If you are offline, it asks whether to leave without saving. Closing the browser or tab may interrupt saving.

## Reuse shapes

Select shapes, right-click and choose “Add to library”. Open the library at the top right and drag saved shapes onto any board. Each user has a \
separate library, available across their devices. To import an .excalidrawlib file, use the library’s ⋯ menu → “Open”. The external library catalogue \
is not available within the portal.

## Board backups

Changed boards are backed up daily; the last seven daily backups are kept. Before major edits, open “Backups” from the board menu or card’s ⋮ menu \
and choose “Make a backup”. You can keep up to 20 manual backups per board.

Restoring a backup saves the current board first, so you can restore it later. Students with the board open see the restored content automatically.

## Add materials to a board

Choose “Add to board” from an assignment, its editor or a submission review. Search for a board and choose “Text” for editable text or “Image” for a \
fixed rendering, useful for formulae and tables. Assignments offer boards shared with their students or groups.

Excalidraw boards open in a new tab with the material already added. An assignment is placed in a frame with its title and today’s date, followed by \
attached images and textbook pages. PDF and Word attachments remain on the assignment page.

For external boards, the material is copied to the clipboard. Paste it with Ctrl+V, or Cmd+V on a Mac. Copying images requires HTTPS.

You can also add [textbook pages](/teacher/help/textbooks) from Materials or an attached textbook. Pages are arranged in a framed row on an \
Excalidraw board.
`,
};
