// Shared test setup for the mobile app.
// @testing-library/react-native v13+ ships its Jest matchers automatically.

jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Native speech and model modules cannot load in Jest. Code that uses them sits
// behind provider interfaces, and tests inject fakes; these mocks only make the
// modules importable.
jest.mock('react-native-sherpa-onnx/extraction', () => ({ extractArchive: jest.fn() }));
jest.mock('react-native-sherpa-onnx/stt', () => ({ createSTT: jest.fn() }));
jest.mock('react-native-sherpa-onnx/tts', () => ({ createTTS: jest.fn() }));
jest.mock('react-native-sherpa-onnx/audio', () => ({ decodeAudioFileToFloatSamples: jest.fn() }));
jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: { create: jest.fn() },
  Tensor: jest.fn(),
}));
jest.mock('expo-speech-recognition', () => ({
  AudioEncodingAndroid: { ENCODING_PCM_16BIT: 2 },
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => false),
    supportsOnDeviceRecognition: jest.fn(() => false),
    start: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  },
}));
jest.mock('llama.rn', () => ({ initLlama: jest.fn(), releaseAllLlama: jest.fn() }));
jest.mock('expo-battery', () => ({
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getPowerStateAsync: jest.fn(() =>
    Promise.resolve({ batteryLevel: 0.8, batteryState: 1, lowPowerMode: false }),
  ),
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ isConnected: true, type: 'WIFI' })),
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR', NONE: 'NONE', ETHERNET: 'ETHERNET' },
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

// expo-audio's native module is absent under Jest; the speaking screens use fakes.
jest.mock('expo-audio', () => ({
  AudioModule: { AudioStream: jest.fn() },
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  getRecordingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, status: 'undetermined', canAskAgain: true }),
  ),
  requestRecordingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, status: 'denied', canAskAgain: true }),
  ),
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined', DENIED: 'denied' },
}));

export {};
