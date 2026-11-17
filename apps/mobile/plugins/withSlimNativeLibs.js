// Expo config plugin: keeps the Android APK small.
//
// 1. Native libraries are stored compressed in the APK (`useLegacyPackaging`),
//    which roughly halves the download; Android unpacks them on install.
// 2. llama.rn ships one ~12 MB copy of llama.cpp per CPU feature level. The
//    APK keeps only the generic copy (and the small JNI wrappers). Each
//    CPU-specific copy that `models/manifest.json` lists as a published
//    `engine` entry is left out of the APK; the app downloads the one the
//    phone can use with the conversation model, and the patched llama.rn
//    loader (`patches/llama.rn@*.patch`) loads it from there. A copy that is
//    not published yet stays in the APK, so nothing is lost before upload.
// 3. Once any engine is published, the Hexagon/OpenCL build is not built or
//    packaged: the app cannot tell which phones have that NPU, and the
//    CPU builds run the Q4_0 models well.
const { withGradleProperties } = require('expo/config-plugins');

const manifest = require('../../../models/manifest.json');

const HEXAGON_VARIANT = 'rnllama_v8_2_dotprod_i8mm_hexagon_opencl';

/** Library file names of the engine builds that are published. */
function publishedEngineLibs(models) {
  return models
    .filter((m) => m.kind === 'engine' && m.files.every((f) => f.available !== false))
    .flatMap((m) => m.files.map((f) => f.name));
}

/** Every llama.rn variant except the Hexagon one, for `rnllamaVariants`. */
const CPU_VARIANTS = [
  'rnllama',
  'rnllama_v8',
  'rnllama_v8_2',
  'rnllama_v8_2_dotprod',
  'rnllama_v8_2_i8mm',
  'rnllama_v8_2_dotprod_i8mm',
  'rnllama_x86_64',
];

/** Gradle properties for a manifest (exported for tests). */
function slimProperties(models) {
  const libs = publishedEngineLibs(models);
  const props = { 'expo.useLegacyPackaging': 'true' };
  if (libs.length > 0) {
    props['android.packagingOptions.excludes'] = [...libs, `lib${HEXAGON_VARIANT}.so`]
      .map((name) => `**/${name}`)
      .join(',');
    props.rnllamaVariants = CPU_VARIANTS.join(',');
  }
  return props;
}

function setProperty(items, key, value) {
  const existing = items.find((item) => item.type === 'property' && item.key === key);
  if (existing) existing.value = value;
  else items.push({ type: 'property', key, value });
}

function withSlimNativeLibs(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(slimProperties(manifest.models))) {
      setProperty(cfg.modResults, key, value);
    }
    return cfg;
  });
}

module.exports = withSlimNativeLibs;
module.exports.slimProperties = slimProperties;
