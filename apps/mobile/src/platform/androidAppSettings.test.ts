// The Android settings config plugin (plugins/withAndroidAppSettings.js).
const { addConfigChanges } = jest.requireActual<{
  addConfigChanges: (current: string | undefined, extra: string[]) => string;
}>('../../plugins/withAndroidAppSettings');

describe('addConfigChanges', () => {
  it('adds font scale and density handling to the existing changes once', () => {
    const once = addConfigChanges('keyboard|orientation|uiMode', ['fontScale', 'density']);
    expect(once).toBe('keyboard|orientation|uiMode|fontScale|density');
    expect(addConfigChanges(once, ['fontScale', 'density'])).toBe(once);
  });

  it('starts from nothing when the activity has no configChanges', () => {
    expect(addConfigChanges(undefined, ['fontScale'])).toBe('fontScale');
  });
});
