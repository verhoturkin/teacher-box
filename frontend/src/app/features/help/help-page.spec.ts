import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { screenWidth } from '@testing/setup';
import { HelpLibrary } from './help-library';
import { HelpPage } from './help-page';

function titles(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('nav .tb-help__item-title')).map((title) =>
    title.textContent.trim(),
  );
}

describe('HelpPage', () => {
  let fixture: ComponentFixture<HelpPage>;

  async function render(
    area: 'teacher' | 'cabinet' | 'admin',
    topic?: string,
    width = 1200,
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [HelpPage],
      providers: [provideRouter([]), providePrimeNG(), screenWidth(width)],
    });
    fixture = TestBed.createComponent(HelpPage);
    fixture.componentRef.setInput('area', area);
    if (topic !== undefined) {
      fixture.componentRef.setInput('topic', topic);
    }
    await TestBed.inject(HelpLibrary).articles(area);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('shows the contents and the first article', async () => {
    const host = await render('teacher');

    const links = Array.from(host.querySelectorAll('nav a'));
    expect(titles(host)).toContain('Первые шаги');
    expect(links[0]?.getAttribute('href')).toBe('/teacher/help/first-steps');
    expect(host.querySelector('h2')?.textContent).toBe('Первые шаги');
  });

  it('opens the article of the address and follows links inside the portal', async () => {
    const host = await render('cabinet', 'schedule');
    expect(host.querySelector('h2')?.textContent).toBe('Расписание и перенос');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    requireElement(host, '.tb-help-article a[href="/cabinet/help/bot"]', HTMLAnchorElement).click();

    expect(navigate).toHaveBeenCalledWith('/cabinet/help/bot');
  });

  it('shows the contents above the article and marks the current one', async () => {
    const host = await render('teacher', 'groups');
    const contents = requireElement(host, 'nav', HTMLElement);
    const article = requireElement(host, '.tb-help__article-card', HTMLElement);
    expect(
      contents.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const current = requireElement(host, 'nav a[aria-current="page"]', HTMLAnchorElement);
    // the summary of an article is under its title, not in a tooltip
    expect(readableText(current)).toBe('Группы Занятия с несколькими учениками сразу');
    expect(current.hasAttribute('title')).toBe(false);
    expect(host.querySelectorAll('nav a[aria-current]')).toHaveLength(1);
    expect(readableText(article)).toContain('Группы Занятия с несколькими учениками сразу');
  });

  it('says when the article is missing', async () => {
    const host = await render('admin', 'nothing');

    expect(readableText(host)).toContain('Такой статьи нет — вот «Журнал и диагностика».');
  });

  it('searches the articles', async () => {
    const host = await render('teacher');

    typeInto(requireElement(host, 'input', HTMLInputElement), 'телемост');
    await fixture.whenStable();
    expect(titles(host)).toContain('Видеовстречи');

    typeInto(requireElement(host, 'input', HTMLInputElement), 'абракадабра');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ничего не нашлось');
  });

  it('puts the contents and the article side by side from expanded', async () => {
    const host = await render('teacher', 'groups', 840);

    const panes = Array.from(host.querySelectorAll('tb-pane'));
    expect(panes).toHaveLength(2);
    expect(panes[0]?.getAttribute('aria-label')).toBe('Статьи справки');
    expect(panes[0]?.querySelector('h1')?.textContent).toBe('Справка');
    expect(panes[1]?.querySelector('h2')?.textContent).toBe('Группы');
    // «back» only on one pane
    expect(host.querySelector('.tb-page-header__back')).toBeNull();
  });

  it('shows only the contents on a phone, nothing marked as open', async () => {
    const host = await render('teacher', undefined, 599);

    expect(host.querySelectorAll('tb-pane')).toHaveLength(1);
    expect(host.querySelector('nav a')).not.toBeNull();
    expect(host.querySelector('h2')).toBeNull();
    expect(host.querySelector('nav a[aria-current]')).toBeNull();
  });

  it('shows only the article of the address on a phone with «back» to the contents', async () => {
    const host = await render('cabinet', 'schedule', 839);

    expect(host.querySelectorAll('tb-pane')).toHaveLength(1);
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('h2')?.textContent).toBe('Расписание и перенос');
    const back = requireElement(host, '.tb-page-header__back', HTMLAnchorElement);
    expect(back.getAttribute('href')).toBe('/cabinet/help');
    expect(back.getAttribute('aria-label')).toBe('Вся справка');
  });
});
