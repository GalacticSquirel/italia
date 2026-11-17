// Expo config plugin: Android app settings the template does not let app.json set.
//
// 1. Release builds are not minified. Expo's template turns R8 on, and R8 strips
//    or renames classes that are only reached by reflection or JNI: WorkManager's
//    Room database (`WorkDatabase_Impl`) went first and the app crashed at
//    startup, and the JNI bridges of llama.rn, sherpa-onnx and ONNX Runtime are
//    at the same risk. Nearly all of the APK is native libraries and assets, so
//    minifying the Java code saves little.
// 2. The main activity handles font scale and display density changes itself.
//    Without `fontScale|density` in its configChanges, changing the system text
//    size recreates the activity: the app restarts on the home screen, losing
//    the screen the learner was on, and a tap during the restart can reach the
//    router before it is ready and crash. React Native re-reads the font scale
//    on a configuration change, so text resizes in place.
const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

const GRADLE_PROPS = {
  'android.enableMinifyInReleaseBuilds': 'false',
  'android.enableShrinkResourcesInReleaseBuilds': 'false',
};

const EXTRA_CONFIG_CHANGES = ['fontScale', 'density'];

function withReleaseBuildProps(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_PROPS)) {
      const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
}

/** `configChanges` with `extra` added once, keeping the existing order. */
function addConfigChanges(current, extra) {
  const parts = (current ?? '').split('|').filter(Boolean);
  for (const change of extra) if (!parts.includes(change)) parts.push(change);
  return parts.join('|');
}

function withActivityConfigChanges(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (!main) throw new Error('withAndroidAppSettings: no .MainActivity in AndroidManifest.xml');
    main.$['android:configChanges'] = addConfigChanges(
      main.$['android:configChanges'],
      EXTRA_CONFIG_CHANGES,
    );
    return cfg;
  });
}

module.exports = function withAndroidAppSettings(config) {
  return withActivityConfigChanges(withReleaseBuildProps(config));
};
module.exports.addConfigChanges = addConfigChanges;
