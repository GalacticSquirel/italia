// Expo config plugin: turns off R8 minification for Android release builds.
//
// Expo's template minifies release builds by default. R8 then strips or renames
// classes that are only reached by reflection or JNI, and the app crashes at
// startup: WorkManager's Room database (`WorkDatabase_Impl`) is the first to go,
// and the JNI bridges of llama.rn, sherpa-onnx and ONNX Runtime are at the same
// risk. Nearly all of the APK is native libraries and assets, so minifying the
// Java code saves little; keeping every class is the safer trade.
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'android.enableMinifyInReleaseBuilds': 'false',
  'android.enableShrinkResourcesInReleaseBuilds': 'false',
};

module.exports = function withNoReleaseMinify(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
