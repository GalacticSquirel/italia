import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportBackup, importBackup, parseBackup, type ImportBackupResult } from '@/data';
import type { AppDatabase } from '@/db';
import { deviceLocalDate } from '@/features/study/time';

/** File name of a backup made on `now`. */
export function backupFileName(now: Date): string {
  return `italia-backup-${deviceLocalDate(now)}.json`;
}

/**
 * Write a backup of all learner data to a file and open the share sheet so
 * the learner can save or send it.
 *
 * @returns false when sharing is not available on this device
 */
export async function shareBackup(db: AppDatabase, now: Date = new Date()): Promise<boolean> {
  const file = new File(Paths.cache, backupFileName(now));
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(exportBackup(db, now)));
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your Italia backup',
    UTI: 'public.json',
  });
  return true;
}

/**
 * Let the learner pick a backup file and merge it into the local data.
 *
 * @returns the import result, or null when the learner cancelled
 * @throws when the file is not a valid backup
 */
export async function pickAndImportBackup(db: AppDatabase): Promise<ImportBackupResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  const text = await new File(asset.uri).text();
  return importBackup(db, parseBackup(text), { strategy: 'merge' });
}
