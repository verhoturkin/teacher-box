import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { HelpLibrary } from './help-library';
import { HelpPage } from './help-page';

describe('HelpPage', () => {
  let fixture: ComponentFixture<HelpPage>;

  async function render(
    area: 'teacher' | 'cabinet' | 'admin',
    topic?: string,
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [HelpPage],
      providers: [provideRouter([]), providePrimeNG()],
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
    expect(links.map((link) => link.textContent.trim())).toContain('Первые шаги');
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

  it('says when the article is missing', async () => {
    const host = await render('admin', 'nothing');

    expect(readableText(host)).toContain('Такой статьи нет — вот «Журнал и диагностика».');
  });

  it('searches the articles', async () => {
    const host = await render('teacher');

    typeInto(requireElement(host, 'input', HTMLInputElement), 'телемост');
    await fixture.whenStable();
    expect(
      Array.from(host.querySelectorAll('nav a')).map((link) => link.textContent.trim()),
    ).toContain('Видеовстречи');

    typeInto(requireElement(host, 'input', HTMLInputElement), 'абракадабра');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ничего не нашлось');
  });
});
