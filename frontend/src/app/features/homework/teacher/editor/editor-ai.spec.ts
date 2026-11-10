import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { assignmentDetails, attachment, boundTextbook } from '@testing/homework-fixtures';
import { readableText } from '@testing/dom';
import { HomeworkAiState } from '@features/ai/parts';
import { screenWidth, testProviders } from '@testing/setup';
import { exactButton, useEditorHarness } from '@testing/homework-editor';

describe('AssignmentEditorPage: the AI assistant', () => {
  const editor = useEditorHarness();

  it('puts an AI draft into the editor', async () => {
    const { page, host } = await editor.create([], true);
    exactButton(host, 'ИИ-помощник').click();
    await editor.fixture.whenStable();

    for (const request of editor.backend.match('/api/teacher/ai/prompts')) {
      request.flush([]);
    }
    const assistant = host.querySelector<HTMLElement>('tb-pane.tb-editor__ai tb-homework-ai-panel');
    expect(assistant).not.toBeNull();
    page.applyDraft({
      draft: { title: 'Проценты', description: '1. Найдите 10%' },
      mode: 'replace',
    });
    await editor.fixture.whenStable();
    expect(page.form.controls.description.value).toBe('Проценты\n\n1. Найдите 10%');
    expect(page.mode.value).toBe('preview');
    expect(host.querySelector('tb-pane.tb-editor__ai tb-homework-ai-panel')).toBe(assistant);

    page.applyDraft({
      draft: { title: 'Ещё', description: '2. Найдите 20%' },
      mode: 'insert',
    });
    expect(page.form.controls.description.value).toBe(
      'Проценты\n\n1. Найдите 10%\n\n2. Найдите 20%',
    );
  });

  it('puts AI questions into the quiz: appended or replacing', async () => {
    const { page } = await editor.create([], true);
    const drafted = (id: string) => ({
      id,
      type: 'NUMBER' as const,
      text: `Вопрос ${id}`,
      points: 1,
      explanation: null,
      options: [],
      correct: [],
      accepted: [],
      value: 2,
      tolerance: 0,
      pairs: [],
    });

    page.applyQuestions({ questions: [drafted('a')], mode: 'append' });
    page.applyQuestions({ questions: [drafted('b')], mode: 'append' });
    expect(page.questions().map((question) => question.text)).toEqual(['Вопрос a', 'Вопрос b']);

    page.applyQuestions({ questions: [drafted('c')], mode: 'replace' });
    expect(page.questions().map((question) => question.text)).toEqual(['Вопрос c']);
  });

  it('preserves AI request, sources and draft when the supporting pane is closed', async () => {
    const { page, host } = await editor.create([], true);
    const state = editor.fixture.debugElement.injector.get(HomeworkAiState);
    state.prompt.setValue('Create exercises');
    state.chosen.set(new Set(['textbook-tb-1']));
    state.draft.set({ title: 'Draft', description: 'Generated text' });
    exactButton(host, 'ИИ-помощник').click();
    await editor.fixture.whenStable();
    for (const request of editor.backend.match('/api/teacher/ai/prompts')) request.flush([]);
    expect(host.querySelector('tb-homework-ai-panel')).not.toBeNull();
    exactButton(host, 'ИИ-помощник').click();
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-homework-ai-panel')).toBeNull();
    exactButton(host, 'ИИ-помощник').click();
    await editor.fixture.whenStable();
    for (const request of editor.backend.match('/api/teacher/ai/prompts')) request.flush([]);
    expect(state.prompt.value).toBe('Create exercises');
    expect(state.chosen().has('textbook-tb-1')).toBe(true);
    expect(readableText(host)).toContain('Generated text');
    expect(page.form.controls.description.value).toBe('');
  });

  it('opens the compact AI assistant as a modal panel and preserves its request on close', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(500)) });
    editor.backend = TestBed.inject(HttpTestingController);
    const { host } = await editor.create([], true);
    const state = editor.fixture.debugElement.injector.get(HomeworkAiState);
    state.prompt.setValue('Keep this request');
    // a phone: an icon button, named by its label
    host.querySelector<HTMLButtonElement>('button[aria-label="ИИ-помощник"]')?.click();
    await editor.fixture.whenStable();
    expect(document.body.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    const close = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Закрыть ИИ-помощника"]',
    );
    expect(close).not.toBeNull();
    close?.click();
    await editor.fixture.whenStable();
    expect(state.prompt.value).toBe('Keep this request');
    for (const request of editor.backend.match('/api/teacher/ai/prompts')) request.flush([]);
  });

  it('offers the assistant the textbooks and the saved files it can read', async () => {
    const { page } = await editor.edit(
      assignmentDetails({
        textbooks: [
          boundTextbook(),
          boundTextbook({ textbookId: 'w', title: 'Word', format: 'DOCUMENT' }),
        ],
        attachments: [
          attachment(),
          attachment({ id: 'z', filename: 'a.zip', contentType: 'application/zip' }),
        ],
      }),
    );

    expect(page.sourceOptions().map((option) => option.label)).toEqual([
      'Spotlight 5, с. 12-14',
      'условие.pdf',
    ]);
    expect(page.sourceOptions()[1]?.source).toEqual({
      type: 'FILE',
      id: 'f-1',
      assignmentId: 'a-1',
    });
  });

  it('edits the videos, saves them and offers their transcripts to the assistant', async () => {
    const video = {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      provider: 'YOUTUBE' as const,
      videoId: 'dQw4w9WgXcQ',
      startSeconds: null,
      title: 'Present Simple',
      transcript: '[0:05] We play',
      transcriptShown: false,
    };
    const { page, host } = await editor.edit(
      assignmentDetails({
        attachments: [],
        videos: [video, { ...video, title: null, transcript: null }],
      }),
    );

    expect(host.querySelector('tb-video-section img')).not.toBeNull();
    expect(page.sourceOptions().map((option) => option.label)).toEqual(['Видео: Present Simple']);
    expect(page.sourceOptions()[0]?.source).toEqual({
      type: 'VIDEO',
      title: 'Present Simple',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      transcript: '[0:05] We play',
    });
    expect(page.canLeave()).toBe(true);

    page.changeVideos(page.videos().slice(0, 1));
    expect(page.canLeave()).not.toBe(true);
    exactButton(host, 'Сохранить').click();
    const put = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1',
    });
    expect(put.request.body).toMatchObject({
      videos: [
        {
          url: 'https://youtu.be/dQw4w9WgXcQ',
          title: 'Present Simple',
          transcript: '[0:05] We play',
          transcriptShown: false,
        },
      ],
    });
    put.flush(assignmentDetails({ version: 1 }));
    await editor.fixture.whenStable();
    expect(editor.navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1']);
  });

  it('offers the assistant the textbooks and readable files picked for a new assignment', async () => {
    const { page } = await editor.create();
    page.pickTextbook(boundTextbook({ pages: null }));
    const scan = new File(['png'], 'Скан.png', { type: 'image/png' });
    page.newFiles.set([scan, new File(['zip'], 'a.zip', { type: 'application/zip' })]);
    expect(page.sourceOptions().map((option) => option.label)).toEqual(['Spotlight 5', 'Скан.png']);
    expect(page.sourceOptions()[1]?.source).toBe(scan);
  });
});
