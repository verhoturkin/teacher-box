import { courseOptions } from './course-options';

describe('courseOptions', () => {
  it('puts «Без курса» before the courses in their order', () => {
    expect(
      courseOptions([
        { id: 'b1', name: 'B1' },
        { id: 'a2', name: 'A2' },
      ]),
    ).toEqual([
      { value: null, label: 'Без курса' },
      { value: 'b1', label: 'B1' },
      { value: 'a2', label: 'A2' },
    ]);
  });
});
