// Expo config plugin: lets react-native-sherpa-onnx and onnxruntime-react-native
// live in one Android app.
//
// Both ship ONNX Runtime native libraries: sherpa-onnx bundles its own
// libonnxruntime.so (and the JNI bridge), and onnxruntime-react-native links its
// JSI module against Microsoft's onnxruntime-android AAR, which it resolves as
// `latest.integration`. Without this plugin the APK merge fails on duplicate
// .so files, and the JSI module could be built against headers newer than the
// runtime that wins the merge. The plugin
//
// 1. pins onnxruntime-android, which onnxruntime-react-native links its JSI
//    module against, to the ONNX Runtime that sherpa-onnx bundles. The library
//    exports its C API under an ELF symbol version named after its release
//    (`OrtGetApiBase@VERS_1.25.0`), so the JSI module must be linked against
//    the same release as the libonnxruntime.so that ends up in the APK, or
//    dlopen fails at startup. Raise SHERPA_ORT_SYMBOL_VERSION whenever a
//    react-native-sherpa-onnx upgrade changes its bundled runtime; check with
//    `llvm-readelf -V lib/arm64-v8a/libonnxruntime.so` on the built APK. And
// 2. keeps the first copy of each duplicated native library.
//
// iOS needs no change here; see docs/speech.md for the iOS build notes.
const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');
// The ONNX Runtime release that react-native-sherpa-onnx 0.4.x bundles (its
// `1.24.4-qnn` build exports VERS_1.25.0).
const SHERPA_ORT_SYMBOL_VERSION = '1.25.0';
const ortVersion = SHERPA_ORT_SYMBOL_VERSION;

/**
 * Insert `block` after the first line matching `anchor`, once (a marker
 * comment makes repeated prebuilds idempotent).
 */
function insertAfter(contents, anchor, block, tag) {
  const marker = `// @generated ${tag}`;
  if (contents.includes(marker)) return contents;
  const match = anchor.exec(contents);
  if (!match) throw new Error(`withOnnxRuntimeCoexistence: no ${String(anchor)} in build.gradle`);
  const end = contents.indexOf('\n', match.index) + 1;
  return `${contents.slice(0, end)}${marker}\n${block}\n${contents.slice(end)}`;
}

const SHARED_LIBS = ['libonnxruntime.so', 'libonnxruntime4j_jni.so', 'libc++_shared.so'];

/** Pin the ORT Android AAR in every project. */
function withPinnedOrt(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withOnnxRuntimeCoexistence: the project build.gradle must be Groovy');
    }
    const pin = [
      '  configurations.all {',
      '    resolutionStrategy {',
      `      force 'com.microsoft.onnxruntime:onnxruntime-android:${ortVersion}'`,
      '    }',
      '  }',
    ].join('\n');
    const contents = cfg.modResults.contents;
    if (contents.includes('// @generated italia-onnxruntime-pin')) return cfg;
    cfg.modResults.contents = /^allprojects\s*\{/m.test(contents)
      ? insertAfter(contents, /^allprojects\s*\{/m, pin, 'italia-onnxruntime-pin')
      : insertAfter(
          `${contents}\nallprojects {\n}\n`,
          /^allprojects\s*\{/m,
          pin,
          'italia-onnxruntime-pin',
        );
    return cfg;
  });
}

/** Keep one copy of the native libraries both modules ship. */
function withPickFirst(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withOnnxRuntimeCoexistence: the app build.gradle must be Groovy');
    }
    cfg.modResults.contents = insertAfter(
      cfg.modResults.contents,
      /^android\s*\{/m,
      [
        '    packagingOptions {',
        '        jniLibs {',
        ...SHARED_LIBS.map((lib) => `            pickFirsts += ['**/${lib}']`),
        '        }',
        '    }',
      ].join('\n'),
      'italia-onnxruntime-pick-first',
    );
    return cfg;
  });
}

module.exports = function withOnnxRuntimeCoexistence(config) {
  return withPickFirst(withPinnedOrt(config));
};
