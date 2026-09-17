// ============================================================
// WRAPPER HAPTICS — Compatible web + mobile
// expo-haptics ne fonctionne que sur iOS/Android.
// Sur web, toutes les fonctions sont des no-ops silencieux.
// ============================================================

import { Platform } from 'react-native';

// Charge expo-haptics uniquement sur mobile
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function impactLight(): Promise<void> {
  if (!isNative) return;
  const Haptics = await import('expo-haptics');
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function impactMedium(): Promise<void> {
  if (!isNative) return;
  const Haptics = await import('expo-haptics');
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export async function notificationError(): Promise<void> {
  if (!isNative) return;
  const Haptics = await import('expo-haptics');
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export async function notificationWarning(): Promise<void> {
  if (!isNative) return;
  const Haptics = await import('expo-haptics');
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export async function notificationSuccess(): Promise<void> {
  if (!isNative) return;
  const Haptics = await import('expo-haptics');
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
