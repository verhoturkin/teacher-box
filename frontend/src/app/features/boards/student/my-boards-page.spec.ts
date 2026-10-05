import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aMyBoard } from '@testing/boards-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MyBoardsPage } from './my-boards-page';

describe('MyBoardsPage', () => {
  let fixture: ComponentFixture<MyBoardsPage>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MyBoardsPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBoardsPage);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists every board of the student', async () => {
    backend
      .expectOne('/api/me/boards')
      .flush([aMyBoard(), aMyBoard({ id: 'b2', title: 'Геометрия' })]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('h1')?.textContent).toContain('Мои доски');
    expect(host.textContent).toContain('изменена 02.10.2026');
    expect(host.querySelectorAll('.tb-list li')).toHaveLength(2);
  });

  it('says when there are no boards and retries a failed load', async () => {
    backend.expectOne('/api/me/boards').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/me/boards').flush([]);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Досок пока нет');
  });
});
