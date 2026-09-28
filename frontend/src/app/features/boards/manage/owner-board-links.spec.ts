import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard } from '@testing/boards-fixtures';
import { hostElement } from '@testing/dom';
import { OwnerBoardLinks } from './owner-board-links';
import { testProviders } from '@testing/setup';

describe('OwnerBoardLinks', () => {
  let fixture: ComponentFixture<OwnerBoardLinks>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [OwnerBoardLinks],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OwnerBoardLinks);
    fixture.componentRef.setInput('ownerIds', ['group-1', null]);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('links the boards of the owners only', async () => {
    backend.expectOne('/api/teacher/boards').flush([
      aBoard(),
      aBoard({
        id: 'board-2',
        ownerId: 'group-1',
        title: 'Общая',
        url: 'https://app.holst.so/g',
      }),
    ]);
    await fixture.whenStable();

    const links = hostElement(fixture).querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain('Общая');
    expect(links[0]?.getAttribute('href')).toBe('https://app.holst.so/g');
  });

  it('shows nothing without boards', async () => {
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent.trim()).toBe('');
  });
});
