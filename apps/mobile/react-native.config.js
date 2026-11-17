// React Native autolinking overrides.
//
// onnxruntime-react-native ships a legacy `unimodule.json`, so Expo's autolinker
// takes it for an Expo module and skips React Native autolinking for it on
// Android. Its Gradle project is still built, but `OnnxruntimePackage` is never
// registered, `NativeModules.Onnxruntime` is null, and the app crashes at
// startup with "Cannot read property 'install' of null". Declaring an Android
// config here makes the autolinker infer and register the package as usual.
// iOS is unaffected: the package's own config plugin adds the pod, and the
// module registers itself there.
module.exports = {
  dependencies: {
    'onnxruntime-react-native': {
      platforms: {
        android: {},
      },
    },
  },
};
