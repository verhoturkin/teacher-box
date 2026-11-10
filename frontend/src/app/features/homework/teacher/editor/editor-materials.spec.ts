import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { assignmentDetails, attachment, boundTextbook } from '@testing/homework-fixtures';
import { buttonByText, readableText } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { exactButton, useEditorHarness } from '@testing/homework-editor';

describe('AssignmentEditorPage: «Материалы»', () => {
  const editor = useEditorHarness();

  it('keeps «Видео» and «Доска» in the materials without the section menu', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(700)) });
    editor.backend = TestBed.inject(HttpTestingController);
    const { host } = await editor.create([]);
    expect(host.querySelector('tb-section-nav')).toBeNull();
    const materials = host.querySelector<HTMLElement>('tb-material-chips') ?? host;
    buttonByText(materials, 'Видео').click();
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-video-section')).not.toBeNull();
    buttonByText(materials, 'Доска').click();
    editor.backend.expectOne('/api/teacher/boards').flush([]);
    await editor.fixture.whenStable();
    expect(document.body.textContent).toContain('Досок пока нет');
  });

  it('edits an assignment without its materials: they are on its page', async () => {
    const details = assignmentDetails({
      textbooks: [boundTextbook()],
      attachments: [attachment()],
    });
    const { page, host } = await editor.edit(details);
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Дроби');
    expect(page.form.controls.description.value).toBe('Дроби\n\nРешить **№1-5**');
    expect(host.querySelector('tb-recipients-field')).toBeNull();
    expect(readableText(host)).not.toContain('Spotlight 5');
    expect(readableText(host)).not.toContain('условие.pdf');
    expect(readableText(host)).not.toContain('Учебник');
    expect(host.querySelector('input[type="file"]')).toBeNull();

    page.form.patchValue({ description: 'Дроби 2\nРешить' });
    page.form.markAsDirty();
    exactButton(host, 'Сохранить').click();
    const put = editor.backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/homework/assignments/a-1',
    });
    expect(put.request.body).toMatchObject({
      title: 'Дроби 2',
      dueAt: '2026-09-10T15:00:00.000Z',
      version: 0,
    });
    put.flush(assignmentDetails({ title: 'Дроби 2', version: 1 }));
    await editor.fixture.whenStable();

    editor.backend.expectNone('/api/teacher/homework/assignments/a-1/attachments');
    expect(editor.navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1']);
  });

  it('keeps the materials of a draft in the editor: picked ones save, saved ones go at once', async () => {
    const { page, host } = await editor.edit(
      assignmentDetails({
        tasks: [],
        textbooks: [boundTextbook({ textbookId: 'tb-1' })],
        attachments: [attachment()],
      }),
    );
    page.autosaveDelay = 0;
    expect(readableText(host)).toContain('Spotlight 5');
    expect(readableText(host)).toContain('условие.pdf');

    page.newFiles.set([new File(['x'], 'ещё.pdf')]);
    await editor.settle();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' })
      .flush(assignmentDetails({ tasks: [], version: 1 }));
    editor.backend
      .expectOne('/api/teacher/homework/assignments/a-1/attachments')
      .flush([attachment()]);
    editor.backend.expectOne('/api/teacher/homework/assignments/a-1').flush(
      assignmentDetails({
        tasks: [],
        version: 1,
        textbooks: [boundTextbook({ textbookId: 'tb-1' })],
        attachments: [attachment(), attachment({ id: 'f-2', filename: 'ещё.pdf' })],
      }),
    );
    await editor.settle();
    expect(page.newFiles()).toEqual([]);
    expect(readableText(host)).toContain('ещё.pdf');

    host.querySelector<HTMLButtonElement>('button[aria-label="Удалить файл ещё.pdf"]')?.click();
    editor.backend
      .expectOne({
        method: 'DELETE',
        url: '/api/teacher/homework/assignments/a-1/attachments/f-2',
      })
      .flush(null);
    await editor.fixture.whenStable();
    expect(readableText(host)).not.toContain('ещё.pdf');

    host
      .querySelector<HTMLButtonElement>('tb-textbook-list button[aria-label^="Убрать из задания"]')
      ?.click();
    editor.backend
      .expectOne({
        method: 'DELETE',
        url: '/api/teacher/homework/assignments/a-1/textbooks/tb-1',
      })
      .flush(assignmentDetails({ tasks: [], version: 1, textbooks: [], attachments: [] }));
    await editor.fixture.whenStable();
    expect(host.querySelector('tb-textbook-list li')).toBeNull();
  });
});
