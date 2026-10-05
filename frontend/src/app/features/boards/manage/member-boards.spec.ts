import { HttpTestingController } from '@angular/common/http/testing';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aBoard } from '@testing/boards-fixtures';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BoardsLink } from './boards-link';
import { MemberBoards } from './member-boards';

@Component({
  imports: [BoardsLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-boards-link [count]="boards.count(['m', 'g'])" name="Мария" studentId="m" />
    <tb-boards-link [count]="boards.count(['g'])" name="ОГЭ" groupId="g" />
  `,
})
class Table {
  readonly boards = new MemberBoards();
}

describe('MemberBoards and BoardsLink', () => {
  it('counts the boards of a student with their groups and links the filtered page', async () => {
    TestBed.configureTestingModule({ imports: [Table], providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Table);
    fixture.componentInstance.boards.load();
    backend.expectOne('/api/teacher/boards').flush([
      aBoard({
        members: [
          { type: 'STUDENT', id: 'm', name: 'Мария' },
          { type: 'GROUP', id: 'g', name: 'ОГЭ' },
        ],
      }),
      aBoard({ id: 'board-2', members: [{ type: 'GROUP', id: 'g', name: 'ОГЭ' }] }),
    ]);
    await fixture.whenStable();

    const links = hostElement(fixture).querySelectorAll('a');
    expect(links[0]?.textContent).toBe('Доски (2)');
    expect(links[0]?.getAttribute('href')).toBe('/teacher/boards?student=m');
    expect(links[0]?.getAttribute('aria-label')).toBe('Доски: Мария, 2');
    expect(links[1]?.getAttribute('href')).toBe('/teacher/boards?group=g');
    expect(fixture.componentInstance.boards.count(['nobody'])).toBe(0);
    backend.verify();
  });
});
