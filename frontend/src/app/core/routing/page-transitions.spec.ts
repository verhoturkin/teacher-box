import { ChangeDetectionStrategy, Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  provideRouter,
  type UrlMatcher,
  type ViewTransitionInfo,
} from '@angular/router';
import { vi } from 'vitest';

import {
  PAGE_CLIP_PROPERTY,
  PAGE_MOTION_ATTRIBUTE,
  PAGE_SURFACE_PROPERTY,
  pageMotion,
  startPageTransition,
} from './page-transitions';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Blank {}

/** A page on two routes of a section, like `help` and `help/:topic`. */
@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Help {}

/** `/teacher/homework` and `/teacher/homework/:id` are one route, like the list and its detail. */
const listDetail: UrlMatcher = (segments) => {
  const [role, section, id, ...rest] = segments;
  return role?.path === 'teacher' &&
    section?.path === 'homework' &&
    rest.length === 0 &&
    id?.path !== 'new' &&
    id?.path !== 'review'
    ? { consumed: segments }
    : null;
};

const ROUTES = [
  { matcher: listDetail, component: Blank },
  { path: 'teacher', component: Blank },
  { path: 'teacher/billing', component: Blank },
  { path: 'teacher/billing/students/:id', component: Blank },
  { path: 'teacher/homework/new', component: Blank },
  { path: 'teacher/homework/review', component: Blank },
  { path: 'teacher/students/:id', component: Blank },
  { path: 'teacher/help', component: Help },
  { path: 'teacher/help/:topic', component: Help },
];

let router: Router;

async function snapshot(url: string): Promise<ActivatedRouteSnapshot> {
  await router.navigateByUrl(url);
  return router.routerState.snapshot.root;
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

  it('keeps the page when only its query changes', async () => {
    expect(
      pageMotion(
        await snapshot('/teacher/students/1'),
        await snapshot('/teacher/students/1?tab=a'),
      ),
    ).toBeNull();
  });

  it('moves the detail of one route by its segments', async () => {
    const list = await snapshot('/teacher/homework');
    const one = await snapshot('/teacher/homework/1');
    const two = await snapshot('/teacher/homework/2');
    expect(pageMotion(list, one)).toBe('forward');
    expect(pageMotion(one, list)).toBe('back');
    expect(pageMotion(one, two)).toBe('through');
    expect(pageMotion(list, one, true)).toBe('detail');
    expect(pageMotion(one, two, true)).toBe('detail');
  });

  it('moves the detail of one page on two routes like the detail of one route', async () => {
    const list = await snapshot('/teacher/help');
    const one = await snapshot('/teacher/help/a');
    expect(pageMotion(list, one)).toBe('forward');
    expect(pageMotion(list, one, true)).toBe('detail');
    expect(pageMotion(await snapshot('/teacher/billing'), one, true)).toBe('through');
  });

  it('slides a page within the frame of its panes until the transition ends', async () => {
    const content = document.createElement('div');
    content.className = 'tb-shell__content';
    content.innerHTML =
      '<tb-panes style="padding: 0 24px 24px 0"><tb-pane style="background: rgb(1, 2, 3)"></tb-pane></tb-panes>';
    document.body.append(content);
    const view = transition();
    const from = await snapshot('/teacher/billing');
    const to = await snapshot('/teacher/billing/students/1');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: view, from, to });
    });
    content.remove();
    const root = document.documentElement;
    expect(root.style.getPropertyValue(PAGE_CLIP_PROPERTY)).toBe(
      'inset(0px 24px 24px 0px round var(--tb-shape-xl))',
    );
    expect(root.style.getPropertyValue(PAGE_SURFACE_PROPERTY)).toBe('rgb(1, 2, 3)');

    view.skipTransition();
    await view.finished;
    await Promise.resolve();
    expect(root.style.getPropertyValue(PAGE_CLIP_PROPERTY)).toBe('');
    expect(root.style.getPropertyValue(PAGE_SURFACE_PROPERTY)).toBe('');
  });

  it('fades only the detail pane beside the list', async () => {
    const content = document.createElement('div');
    content.className = 'tb-shell__content';
    content.innerHTML = '<tb-panes><tb-pane></tb-pane><tb-pane></tb-pane></tb-panes>';
    document.body.append(content);
    const view = transition();
    const from = await snapshot('/teacher/homework/1');
    const to = await snapshot('/teacher/homework/2');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: view, from, to });
    });
    content.remove();
    expect(document.documentElement.getAttribute(PAGE_MOTION_ATTRIBUTE)).toBe('detail');
  });

  it('fades only the detail column of a list inside one pane', async () => {
    const content = document.createElement('div');
    content.className = 'tb-shell__content';
    content.innerHTML =
      '<tb-panes><tb-pane><nav></nav><div data-tb-detail></div></tb-pane></tb-panes>';
    document.body.append(content);
    const view = transition();
    const from = await snapshot('/teacher/homework');
    const to = await snapshot('/teacher/homework/1');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: view, from, to });
    });
    content.remove();
    expect(document.documentElement.getAttribute(PAGE_MOTION_ATTRIBUTE)).toBe('detail');
  });

  it('marks the root with the motion until the transition ends', async () => {
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

  it('skips the transition when the page stays', async () => {
    const same = transition();
    const one = await snapshot('/teacher/students/1');
    const two = await snapshot('/teacher/students/1?tab=a');
    runInInjectionContext(TestBed.inject(Injector), () => {
      startPageTransition({ transition: same, from: one, to: two });
    });
    expect(same.skipTransition).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(PAGE_MOTION_ATTRIBUTE)).toBe(false);
  });
});
