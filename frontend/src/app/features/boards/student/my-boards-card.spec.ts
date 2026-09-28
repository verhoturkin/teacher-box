import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { aMyBoard } from '@testing/boards-fixtures';
import { hostElement } from '@testing/dom';
import { MyBoardsCard } from './my-boards-card';

describe('MyBoardsCard', () => {
  let fixture: ComponentFixture<MyBoardsCard>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MyBoardsCard],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBoardsCard);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('opens the boards of the student and of their groups', async () => {
    backend
      .expectOne('/api/me/boards')
      .flush([
        aMyBoard(),
        aMyBoard({ id: 'board-2', ownerType: 'GROUP', groupName: 'ОГЭ', title: 'Общая' }),
      ]);
    await fixture.whenStable();

    const text = hostElement(fixture).textContent;
    expect(text).toContain('Мои доски');
    expect(text).toContain('группа «ОГЭ»');
    const links = hostElement(fixture).querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('https://app.holst.so/board/1');
    expect(links[0]?.getAttribute('target')).toBe('_blank');
  });

  it('is hidden while there are no boards', async () => {
    backend.expectOne('/api/me/boards').flush([]);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).not.toContain('Мои доски');
  });
});
