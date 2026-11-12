import { ChangeDetectionStrategy, Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  provideRouter,
  type ViewTransitionInfo,
} from '@angular/router';
import { vi } from 'vitest';

import { PAGE_MOTION_ATTRIBUTE, pageMotion, startPageTransition } from './page-transitions';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Blank {}

const ROUTES = [
  { path: 'teacher', component: Blank },
  { path: 'teacher/billing', component: Blank },
  { path: 'teacher/billing/students/:id', component: Blank },
  { path: 'teacher/homework/new', component: Blank },
  { path: 'teacher/homework/review', component: Blank },
  { path: 'teacher/students/:id', component: Blank },
];

let router: Router;

async function snapshot(url: string): Promise<ActivatedRouteSnapshot> {
  await router.navigateByUrl(url);
  return router.routerState.snapshot.root;
}

/** The system setting «reduce motion». */
class ReducedMotion extends EventTarget implements MediaQueryList {
  readonly media = '(prefers-reduced-motion: reduce)';
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  constructor(readonly matches: boolean) {
    super();
  }

  addListener(): void {
    // deprecated API
  }

  removeListener(): void {
    // deprecated API
  }
}

function media(reduced: boolean): void {
  vi.spyOn(window, 'matchMedia').mockReturnValue(new ReducedMotion(reduced));
}

/** A view transition that finishes when it is skipped. */
class FakeTransition implements ViewTransition {
  readonly ready = Promise.resolve(undefined);
  readonly updateCallbackDone = Promise.resolve(undefined);
  readonly types: ViewTransitionTypeSet = new Set<string>();
  readonly finished: Promise<undefined>;
  readonly skipTransition = vi.fn((): void => {
    this.finish();
  });
  private finish: () => void = () => undefined;

  constructor() {
    this.finished = new Promise<undefined>((resolve) => {
      this.finish = () => {
        resolve(undefined);
      };
    });
  }
}

function transition(): FakeTransition {
  return new FakeTransition();
}

describe('page transitions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ROUTES)] });
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute(PAGE_MOTION_ATTRIBUTE);
  });

  it('fades through between sections and pages of equal depth', async () => {
    expect(pageMotion(await snapshot('/teacher'), await snapshot('/teacher/billing'))).toBe(
      'through',
    );
    expect(
      pageMotion(
        await snapshot('/teacher/homework/new'),
        await snapshot('/teacher/homework/review'),
      ),
    ).toBe('through');
    expect(
      pageMotion(
        await snapshot('/teacher/billing/students/1'),
        await snapshot('/teacher/homework/new'),
      ),
    ).toBe('through');
  });

  it('slides deeper into a section and back out of it', async () => {
    const list = await snapshot('/teacher/billing');
    const student = await snapshot('/teacher/billing/students/1');
    expect(pageMotion(list, student)).toBe('forward');
    expect(pageMotion(student, list)).toBe('back');
  });

  it('keeps the page when only its parameters change', async () => {
    expect(
      pageMotion(await snapshot('/teacher/students/1'), await snapshot('/teacher/students/2')),
    ).toBeNull();
  });

  it('marks the root with the motion until the transition ends', async () => {
    media(false);
    const view = transition();
    const info: ViewTransitionInfo = {
      transition: view,
      from: await snapshot('/teacher/billing'),
      to: await snapshot('/teacher/billing/students/1'),
    };
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition(info);
    });
    const root = document.documentElement;
    expect(root.getAttribute(PAGE_MOTION_ATTRIBUTE)).toBe('forward');
    expect(view.skipTransition).not.toHaveBeenCalled();

    view.skipTransition();
    await view.finished;
    await Promise.resolve();
    expect(root.hasAttribute(PAGE_MOTION_ATTRIBUTE)).toBe(false);
  });

  it('leaves the mark of a newer transition in place', async () => {
    media(false);
    const first = transition();
    const second = transition();
    const from = await snapshot('/teacher');
    const to = await snapshot('/teacher/billing');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: first, from, to });
      startPageTransition({ transition: second, from: to, to: from });
    });
    first.skipTransition();
    await first.finished;
    await Promise.resolve();
    expect(document.documentElement.getAttribute(PAGE_MOTION_ATTRIBUTE)).toBe('through');
  });

  it('skips the transition when the page stays or the system asks for less motion', async () => {
    const same = transition();
    media(false);
    const one = await snapshot('/teacher/students/1');
    const two = await snapshot('/teacher/students/2');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: same, from: one, to: two });
    });
    expect(same.skipTransition).toHaveBeenCalled();

    media(true);
    const reduced = transition();
    const list = await snapshot('/teacher/billing');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: reduced, from: one, to: list });
    });
    expect(reduced.skipTransition).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(PAGE_MOTION_ATTRIBUTE)).toBe(false);
  });
});
