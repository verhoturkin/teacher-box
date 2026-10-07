import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aMyTextbook } from '@testing/textbooks-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
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
