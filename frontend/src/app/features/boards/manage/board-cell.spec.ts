import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { aBoard } from '@testing/boards-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { BoardCell } from './board-cell';

describe('BoardCell', () => {
  let fixture: ComponentFixture<BoardCell>;
  let edits: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BoardCell], providers: [providePrimeNG()] });
    fixture = TestBed.createComponent(BoardCell);
    edits = 0;
    fixture.componentInstance.edit.subscribe(() => edits++);
    fixture.componentRef.setInput('name', 'Мария');
    await fixture.whenStable();
  });

  it('offers to add a board', () => {
    expect(hostElement(fixture).querySelector('a')).toBeNull();
    buttonByText(hostElement(fixture), 'Добавить доску: Мария').click();
    expect(edits).toBe(1);
  });

  it('opens the first board and counts the others', async () => {
    fixture.componentRef.setInput('boards', [aBoard(), aBoard({ id: 'board-2', title: 'Геометрия' })]);
    await fixture.whenStable();

    const link = hostElement(fixture).querySelector('a');
    expect(link?.textContent).toContain('Алгебра');
    expect(link?.getAttribute('href')).toBe('https://app.holst.so/board/1');
    expect(hostElement(fixture).textContent).toContain('+1');
    buttonByText(hostElement(fixture), 'Доски: Мария').click();
    expect(edits).toBe(1);
  });
});
