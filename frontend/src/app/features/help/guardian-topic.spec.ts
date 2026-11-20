import { guardianTopicOf } from './help-topics';

describe('guardianTopicOf', () => {
  it('maps the student’s topics to the parent’s articles and keeps the others (455.1)', () => {
    expect(guardianTopicOf('cabinet/login')).toBe('guardian/start');
    expect(guardianTopicOf('cabinet/schedule')).toBe('guardian/requests');
    expect(guardianTopicOf('cabinet/bot')).toBe('guardian/bot');
    expect(guardianTopicOf('cabinet/billing')).toBe('guardian/view');
    expect(guardianTopicOf('guardian/bot')).toBe('guardian/bot');
    expect(guardianTopicOf('teacher/schedule')).toBe('teacher/schedule');
  });
});
