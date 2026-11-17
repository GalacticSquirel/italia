import { speechLanguage } from './speechLanguage';

describe('speechLanguage', () => {
  it('gives Android expo-speech a bare language code', () => {
    expect(speechLanguage('it-IT', 'android')).toBe('it');
    expect(speechLanguage('en-GB', 'android')).toBe('en');
    expect(speechLanguage('it', 'android')).toBe('it');
  });

  it('keeps the full tag on iOS', () => {
    expect(speechLanguage('it-IT', 'ios')).toBe('it-IT');
  });
});
