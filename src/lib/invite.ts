import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

/** The link people open to join a group. Uses your website if EXPO_PUBLIC_WEB_URL is set. */
export function inviteUrl(code: string): string {
  const web = process.env.EXPO_PUBLIC_WEB_URL;
  if (web) return `${web.replace(/\/$/, '')}/join/${code}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const baseUrl = Constants.expoConfig?.experiments?.baseUrl ?? '';
    return `${window.location.origin}${baseUrl}/join/${code}`;
  }
  return Linking.createURL(`/join/${code}`);
}

/**
 * Opens the share sheet with `message`. On the web, where sharing is often unavailable,
 * copies `copyText` (or the message) to the clipboard instead.
 */
export async function shareOrCopy(message: string, copyText = message): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: message });
        return 'shared';
      } catch {
        // Cancelled or not allowed: fall back to copying.
      }
    }
    await navigator.clipboard.writeText(copyText);
    return 'copied';
  }
  await Share.share({ message });
  return 'shared';
}

export function shareInvite(groupName: string, code: string) {
  const url = inviteUrl(code);
  return shareOrCopy(`Join "${groupName}" on FairTab to split expenses: ${url}`, url);
}
