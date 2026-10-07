import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aMyTextbook } from '@testing/textbooks-fixtures';
import { buttonByText, hostElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { MyTextbooksPage } from './my-textbooks-page';

describe('MyTextbooksPage', () => {
  let fixture: ComponentFixture<MyTextbooksPage>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MyTextbooksPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyTextbooksPage);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists the textbooks of the student and downloads one', async () => {
    const save = vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation(() => undefined);
    backend
      .expectOne('/api/me/textbooks')
      .flush([aMyTextbook(), aMyTextbook({ id: 'tb-2', title: 'Тетрадь', groupNames: [] })]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('h1')?.textContent).toContain('Учебники');
    expect(host.querySelectorAll('.tb-list li')).toHaveLength(2);
    expect(host.textContent).toContain('Группа: ОГЭ');
    host.querySelector<HTMLButtonElement>('button[aria-label="Скачать Тетрадь"]')?.click();
    backend.expectOne('/api/me/textbooks/tb-2/file').flush(new Blob(['%PDF']));
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'Spotlight 5.pdf');

    const open = vi.spyOn(TestBed.inject(FileOpener), 'open').mockImplementation(() => undefined);
    host.querySelector<HTMLButtonElement>('button[aria-label="Открыть Spotlight 5"]')?.click();
    expect(open).toHaveBeenCalledWith(expect.anything(), true, expect.any(Function));
    expect(open.mock.calls[0]?.[2](new Blob())).toBe('Spotlight 5.pdf');

    const search = host.querySelector<HTMLInputElement>('input[aria-label="Поиск по названию"]');
    if (search === null) throw new Error('No search');
    typeInto(search, 'тетр');
    await fixture.whenStable();
    expect(host.querySelectorAll('.tb-list li')).toHaveLength(1);
    typeInto(search, 'нет такого');
    await fixture.whenStable();
    expect(host.textContent).toContain('Ничего не найдено');
  });

  it('says when there are no textbooks and retries a failed load', async () => {
    backend.expectOne('/api/me/textbooks').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/me/textbooks').flush([]);
    await fixture.whenStable();
    expect(hostElement(fixture).textContent).toContain('Учебников пока нет');
  });
});
