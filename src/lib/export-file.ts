import { Platform, Share } from 'react-native';

/**
 * Gives the user a CSV file. On the web it downloads `fileName`.
 * On phones it opens the share sheet with the CSV as text (to send by email, save in Notes or Drive...),
 * because saving real files needs expo-file-system and expo-sharing, which this app does not include yet.
 */
export async function exportCsvFile(fileName: string, csv: string): Promise<'downloaded' | 'shared'> {
  if (Platform.OS === 'web') {
    // The invisible mark at the start tells Excel the file is UTF-8, so names like "Zoë" or "سارا" show correctly.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Some browsers start the download a moment later, so don't free the file right away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  }
  await Share.share({ message: csv, title: fileName }, { subject: fileName, dialogTitle: fileName });
  return 'shared';
}
