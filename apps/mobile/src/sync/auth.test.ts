import { authErrorMessage } from './auth';

describe('authErrorMessage', () => {
  it('words a wrong or expired code for the learner', () => {
    expect(
      authErrorMessage({ message: 'Token has expired or is invalid', code: 'otp_expired' }),
    ).toBe('That code is wrong or has expired. Check the latest email, or send a new code.');
    expect(authErrorMessage({ message: 'Token has expired or is invalid' })).toMatch(
      /wrong or has expired/,
    );
  });

  it('explains rate limits and network failures', () => {
    expect(authErrorMessage({ message: 'x', code: 'over_email_send_rate_limit' })).toMatch(
      /Too many tries/,
    );
    expect(authErrorMessage({ message: 'x', status: 429 })).toMatch(/Too many tries/);
    expect(
      authErrorMessage({ message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 }),
    ).toMatch(/Could not reach the sync server/);
  });

  it('keeps any other server message', () => {
    expect(authErrorMessage({ message: 'Signups not allowed for this instance' })).toBe(
      'Signups not allowed for this instance',
    );
  });
});
