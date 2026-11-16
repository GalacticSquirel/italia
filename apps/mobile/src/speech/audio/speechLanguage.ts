import { Platform } from 'react-native';

/**
 * The `language` to give expo-speech for a BCP 47 tag. On Android expo-speech
 * builds the locale with `Locale.Builder().setLanguage(language)`, which only
 * takes a bare language code: "it-IT" is rejected as ill-formed and the phone's
 * default voice (usually English) reads the Italian. iOS takes the full tag.
 */
export function speechLanguage(tag: string, os: string = Platform.OS): string {
  return os === 'android' ? (tag.split(/[-_]/u)[0] ?? tag) : tag;
}
