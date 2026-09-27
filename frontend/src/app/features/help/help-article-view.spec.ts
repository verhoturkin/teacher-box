import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { hostElement, requireElement } from '@testing/dom';
import { HelpArticleView } from './help-article-view';

describe('HelpArticleView', () => {
  let fixture: ComponentFixture<HelpArticleView>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let followed: string[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HelpArticleView], providers: [provideRouter([])] });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(HelpArticleView);
    followed = [];
    fixture.componentInstance.navigated.subscribe((href) => followed.push(href));
    fixture.componentRef.setInput('body', '**Шаг** [Группы](/teacher/help/groups) и [Холст](https://app.holst.so)');
    await fixture.whenStable();
  });

  it('renders Markdown and opens portal links in place', () => {
    const host = hostElement(fixture);
    expect(host.querySelector('strong')?.textContent).toBe('Шаг');

    requireElement(host, 'a[href="/teacher/help/groups"]', HTMLAnchorElement).click();

    expect(navigate).toHaveBeenCalledWith('/teacher/help/groups');
    expect(followed).toEqual(['/teacher/help/groups']);
  });

  it('leaves other links and clicks alone', () => {
    const host = hostElement(fixture);
    const external = new MouseEvent('click', { bubbles: true, cancelable: true });
    requireElement(host, 'a[href="https://app.holst.so"]', HTMLAnchorElement).dispatchEvent(external);
    const withCtrl = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    requireElement(host, 'a[href="/teacher/help/groups"]', HTMLAnchorElement).dispatchEvent(withCtrl);
    requireElement(host, 'strong', HTMLElement).click();

    expect(external.defaultPrevented).toBe(false);
    expect(withCtrl.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
