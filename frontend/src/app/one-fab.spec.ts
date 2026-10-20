import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BillingOverviewPage } from '@features/billing';
import { TeacherHome } from '@features/home';
import { AssignmentsPage } from '@features/homework';
import { StudentsPage } from '@features/identity';
import { MaterialsPage } from '@features/materials';
import { SchedulePage } from '@features/schedule';
import { hostElement } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';

/** The pages whose create action is an item of the rail's «Создать» (spec §1 principle 5, §4 row «Create»). */
const IN_CREATE_MENU: readonly [string, Type<unknown>][] = [
  ['TeacherHome', TeacherHome],
  ['SchedulePage', SchedulePage],
  ['AssignmentsPage', AssignmentsPage],
  ['BillingOverviewPage', BillingOverviewPage],
  ['StudentsPage', StudentsPage],
  ['MaterialsPage', MaterialsPage],
];

/** The page's own FAB: the main action of the header (the extended FAB on a phone) or the FAB menu. */
function pageFabs(page: Type<unknown>, width: number): number {
  TestBed.configureTestingModule({ imports: [page], providers: testProviders(screenWidth(width)) });
  const fixture = TestBed.createComponent(page);
  fixture.detectChanges();
  const count = hostElement(fixture).querySelectorAll('.tb-page-fab, tb-fab-menu').length;
  fixture.destroy();
  return count;
}

describe('One FAB per screen', () => {
  // the rail with «Создать» is there from 600 px (CreateMenu, shell.spec.ts)
  describe.each([
    [599, 1],
    [600, 0],
    [840, 0],
    [1600, 0],
  ])('at %i px', (width, own) => {
    it.each(IN_CREATE_MENU)('%s: its create action only on a phone', (_name, page) => {
      expect(pageFabs(page, width)).toBe(own);
    });
  });
});
