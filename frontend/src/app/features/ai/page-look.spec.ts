import { currentPageLook, hexColor } from './page-look';

describe('page look', () => {
  it('reads colours as #rrggbb', () => {
    expect(hexColor(' #1B6B5A ')).toBe('#1b6b5a');
    expect(hexColor('#abc')).toBe('#aabbcc');
    expect(hexColor('rgb(255, 0, 16)')).toBe('#ff0010');
    expect(hexColor('rgba(1 2 3 / 50%)')).toBe('#010203');
    expect(hexColor('rgb(300, 0, 0)')).toBeNull();
    expect(hexColor('red')).toBeNull();
    expect(hexColor('')).toBeNull();
  });

  it('takes the portal colours and a safe font, or nothing', () => {
    const root = document.createElement('div');
    document.body.append(root);
    document.body.style.fontFamily = '"Noto Sans", sans-serif';

    expect(currentPageLook(root)).toBeNull();

    root.style.setProperty('--p-md-primary', '#336699');
    root.style.setProperty('--p-md-surface', '#fff');
    root.style.setProperty('--p-md-on-surface', 'rgb(17, 17, 17)');
    expect(currentPageLook(root)).toEqual({
      font: '"Noto Sans", sans-serif',
      primary: '#336699',
      surface: '#ffffff',
      text: '#111111',
    });

    document.body.style.fontFamily = '';
    expect(currentPageLook(root)?.font).toBe('system-ui, sans-serif');
    root.remove();
  });
});
