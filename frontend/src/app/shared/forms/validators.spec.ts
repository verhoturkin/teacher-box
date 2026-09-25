import { FormControl, FormGroup } from '@angular/forms';
import { fieldsMatch } from './validators';

describe('fieldsMatch', () => {
  it('reports mismatching values', () => {
    const form = new FormGroup(
      { password: new FormControl('secret-1'), confirm: new FormControl('secret-2') },
      { validators: [fieldsMatch('password', 'confirm')] },
    );

    expect(form.hasError('fieldsMismatch')).toBe(true);

    form.controls.confirm.setValue('secret-1');
    expect(form.hasError('fieldsMismatch')).toBe(false);
  });
});
