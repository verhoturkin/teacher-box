import { HelpArticleText } from '@features/help/help.models';

export const aiArticle: HelpArticleText = {
  title: 'AI assistant',
  summary: 'Draft assignments, quiz questions, feedback and lesson summaries',
  body: `
The AI assistant produces drafts for you to review. You decide what to save and send.

## Create a draft

In the assignment editor, open “AI assistant” and describe what you need. Choose “Generate”, then review the result. “Replace” uses the draft title \
and text; “Append” adds the text after your own; “Discard” dismisses it; “Regenerate” requests another version. Drafts are not saved automatically.

On wide screens, the assistant opens beside the editor. On smaller screens it opens in a dialog. Closing it or resizing the window preserves your \
instructions, selected sources and draft. The Text/Preview switch changes the view of the same Markdown field.

## Choose source materials

Use “Source materials” to select attached textbook pages, PDFs and images: up to five files and 20 pages at once. Files selected for a new assignment \
can be used before saving it. Word documents are not supported as sources.

Videos with transcripts are also available as sources. The AI reads the transcript, rather than watching the video, and can refer to timestamps such \
as [1:05]. If the video is not listed, add a transcript in its settings first: import YouTube captions or load a file.

Select “Questions” under “What to prepare” to draft quiz questions. Review them in the editor before saving.

## Reuse prompts and draft feedback

Open “Prompts” to find saved instructions. “Save as prompt” adds your current instructions to the library. Rename, edit or delete entries under \
“Settings” → “AI assistant” → “My prompts”, or use “Manage prompts”.

When reviewing a submission, “AI draft” suggests feedback, a grade and whether to accept it or request revisions. Check the suggestion before \
inserting it. Lesson summaries also offer AI drafts in the lesson details.

## Customise system prompts

Open “Settings” → “AI assistant”; the system prompts are open on the page. Edit the instructions for assignment or review drafts to set the tone, \
language and structure you prefer. Saved overrides are marked “Custom” and apply to future drafts.

The portal handles the response format and sends assignment and student response content separately. “Restore default” removes your custom \
instructions.

## Usage and limits

The AI settings show your model, tokens used this month and remaining allowance. Recent requests show the result, time, model, token count and any \
error. The latest ten appear first; choose “Show more” for other requests this month. Once the monthly allowance is exhausted, AI actions become \
unavailable until the next month.

## Connections and models

You connect the AI yourself: “Settings” → “AI assistant” → “Connections” → “Add”. Pick a provider — Anthropic (Claude), Gemini, OpenRouter (many \
companies’ models with one key), DeepSeek or an OpenAI-compatible server such as your own Ollama — paste the API key and choose “Check and continue”. \
If the key is rejected, the provider’s reply appears under the field. In the second step, select the models you want (search helps with a long list) \
or add one by hand using its model ID. If the provider cannot be reached from the server’s network, set a proxy under “Advanced”.

Drafts are written by the default model, which is marked in the list. To change it, select another model’s radio button or choose “Make default” from \
its “⋮” menu, where you can also rename or delete it. The monthly token limit is shared by all connections; 0 means no limit. The usage bar shows how \
much each model used. If AI buttons are missing, no default model is selected.

With more than one model, a button with the model’s name sits next to “Generate” (next to “AI draft” when reviewing work, and next to “Generate \
draft” in a lesson summary). Its menu lists the models by connection: choose the one that should write the draft. This device remembers your choice \
everywhere the AI writes; another computer or phone still uses the default model. You cannot choose a model whose connection has an error until it \
works again. If the chosen model is deleted, drafts go back to the default model.

Which connection to pick. One is enough: add the provider whose key you already have. A second is
worth it when different jobs suit different models — say, a stronger one for marking work and a
quick one for assignment drafts — or as a fallback provider if one has an outage. OpenRouter gives
you many companies’ models behind one key; your own server (Ollama, for instance) needs no key and
sends no text out of your network.

Each connection can have its own proxy. If one provider cannot be reached from the server’s network
(Gemini from Russia, say), set a proxy for that connection only under “Advanced”; the others connect
directly. A connection with no proxy of its own uses the administrator’s shared proxy.
`,
};
