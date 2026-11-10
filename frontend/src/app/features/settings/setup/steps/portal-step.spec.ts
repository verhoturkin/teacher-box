import { FormControl, FormGroup } from '@angular/forms';
import { hostElement, readableText } from '@testing/dom';
import { SETUP_ACCOUNT, renderStep } from '@testing/setup-fixtures';
import { PortalForm, SetupPortalPreview, SetupPortalStep } from './portal-step';

function portalForm(): PortalForm {
  return new FormGroup({
    teacherName: new FormControl('Учитель', { nonNullable: true }),
    portalName: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
  });
}

describe('SetupPortalStep', () => {
  it('shows the photo, the names and the address and submits by Enter', async () => {
    const fixture = await renderStep(SetupPortalStep, {
      form: portalForm(),
      account: SETUP_ACCOUNT,
    });
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    const host = hostElement(fixture);
    expect(host.querySelector('tb-profile-photo')).not.toBeNull();
    expect(host.querySelector('#setup-teacher-name')).not.toBeNull();
    expect(host.querySelector('#setup-portal-name')).not.toBeNull();
    expect(host.querySelector('#setup-address')).not.toBeNull();

    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(submitted).toHaveBeenCalled();
  });

  it('waits for the account before the photo', async () => {
    const fixture = await renderStep(SetupPortalStep, { form: portalForm(), account: null });
    expect(hostElement(fixture).querySelector('tb-profile-photo')).toBeNull();
  });
});

describe('SetupPortalPreview', () => {
  it('shows the sign-in and the invitation as they are typed', async () => {
    const fixture = await renderStep(SetupPortalPreview, {
      values: {
        teacherName: ' Елена Викторовна ',
        portalName: 'Английский с Еленой',
        address: 'https://school.example.com',
      },
    });
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Елена Викторовна приглашает вас в «Английский с Еленой»');
    expect(text).toContain('school.example.com/invite/…');
  });

  it('names the portal «Teacher Box» and links where it is open now', async () => {
    const fixture = await renderStep(SetupPortalPreview, { values: { portalName: ' ' } });
    const text = readableText(hostElement(fixture));
    expect(text).toContain('приглашает вас в «Teacher Box»');
    expect(text).toContain(`${window.location.host}/invite/…`);
  });
});
