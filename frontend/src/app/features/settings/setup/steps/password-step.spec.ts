import { hostElement, readableText } from '@testing/dom';
import { renderStep } from '@testing/setup-fixtures';
import { SetupPasswordStep } from './password-step';

describe('SetupPasswordStep', () => {
  it('asks for the generated password and a new one, with «Далее»', async () => {
    const host = hostElement(await renderStep(SetupPasswordStep, {}));
    expect(host.querySelector('#current')).not.toBeNull();
    expect(host.querySelector('#next')).not.toBeNull();
    expect(host.querySelector('#confirm')).not.toBeNull();
    expect(readableText(host)).toContain('Далее');
  });
});
