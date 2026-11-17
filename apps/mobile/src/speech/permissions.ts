import {
  getRecordingPermissionsAsync,
  PermissionStatus,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

/** Microphone permission state. */
export type MicStatus = 'granted' | 'undetermined' | 'denied' | 'blocked';

/** Microphone permission checks (faked in tests). */
export interface MicPermissions {
  get(): Promise<MicStatus>;
  request(): Promise<MicStatus>;
}

type Response = Awaited<ReturnType<typeof getRecordingPermissionsAsync>>;

function statusOf(response: Response): MicStatus {
  if (response.granted) return 'granted';
  if (response.status === PermissionStatus.UNDETERMINED) return 'undetermined';
  return response.canAskAgain ? 'denied' : 'blocked';
}

/** Microphone permission through expo-audio. */
export const deviceMicPermissions: MicPermissions = {
  async get() {
    return statusOf(await getRecordingPermissionsAsync());
  },
  async request() {
    return statusOf(await requestRecordingPermissionsAsync());
  },
};
