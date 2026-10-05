import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BoardLinks } from './board-links';

describe('BoardLinks', () => {
  let fixture: ComponentFixture<BoardLinks>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BoardLinks], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardLinks);
  });

  afterEach(() => {
    backend.verify();
  });

  it('links the boards of a student: the editor or the external link', async () => {
    fixture.componentRef.setInput('studentId', 's-1');
    await fixture.whenStable();
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([aBoard(), aLinkBoard()]);
    await fixture.whenStable();

    const links = hostElement(fixture).querySelectorAll('a');
    expect(links[0]?.getAttribute('href')).toBe('/teacher/boards/board-1');
    expect(links[1]?.getAttribute('href')).toBe('https://app.holst.so/board/1');
    expect(links[1]?.getAttribute('target')).toBe('_blank');
  });

  it('shows nothing without boards or without anyone', async () => {
    fixture.componentRef.setInput('groupId', 'g-1');
    await fixture.whenStable();
    backend.expectOne('/api/teacher/boards?groupId=g-1').flush([]);
    await fixture.whenStable();
    expect(hostElement(fixture).textContent.trim()).toBe('');

    fixture.componentRef.setInput('groupId', null);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('a')).toBeNull();
  });
});
