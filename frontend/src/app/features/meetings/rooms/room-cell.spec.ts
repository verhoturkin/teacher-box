import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement } from '@testing/dom';
import { aRoom } from '@testing/meetings-fixtures';
import { RoomCell } from './room-cell';

describe('RoomCell', () => {
  let fixture: ComponentFixture<RoomCell>;
  let edits: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [RoomCell], providers: [providePrimeNG()] });
    fixture = TestBed.createComponent(RoomCell);
    edits = 0;
    fixture.componentInstance.edit.subscribe(() => edits++);
    fixture.componentRef.setInput('name', 'Мария');
    await fixture.whenStable();
  });

  it('offers to add a room', () => {
    buttonByText(hostElement(fixture), 'Добавить видеовстречу: Мария').click();
    expect(edits).toBe(1);
  });

  it('opens the room and its settings', async () => {
    fixture.componentRef.setInput('room', aRoom());
    await fixture.whenStable();

    const link = hostElement(fixture).querySelector('a');
    expect(link?.textContent).toContain('Телемост');
    expect(link?.getAttribute('href')).toBe('https://telemost.yandex.ru/j/12345678901234');
    buttonByText(hostElement(fixture), 'Видеовстреча: Мария').click();
    expect(edits).toBe(1);

    fixture.componentRef.setInput('room', aRoom({ telemost: false }));
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('a')?.textContent).toContain('Ссылка');
  });
});
