import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { screenWidth } from '@testing/setup';
import { injectMobile, injectWindowSize } from './mobile';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Probe {
  readonly size = injectWindowSize();
  readonly mobile = injectMobile();
}

describe('injectWindowSize', () => {
  function probe(width: number): Probe {
    TestBed.configureTestingModule({ providers: [screenWidth(width)] });
    return TestBed.createComponent(Probe).componentInstance;
  }

  it.each([
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
    [1199, 'expanded'],
    [1200, 'large'],
    [1599, 'large'],
    [1600, 'extra-large'],
  ])('at %i px is %s (M3 breakpoints, ADR-0048)', (width, size) => {
    const component = probe(width);

    expect(component.size()).toBe(size);
    expect(component.mobile()).toBe(size === 'compact');
  });

  it('is expanded before the observer answers', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.createComponent(Probe).componentInstance.size()).toBe('expanded');
  });
});
