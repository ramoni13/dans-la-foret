// ============================================================
// locale.ts — Types et détection du système (sans import store)
// Importé par playerStore ET par i18n/index.ts sans circularité.
//
// Détection de la locale sans expo-localization :
//   - Web : navigator.language
//   - Native : Intl.DateTimeFormat().resolvedOptions().locale (disponible RN 0.73+)
//   - Fallback : 'fr'
// ============================================================

import { Platform, NativeModules } from 'react-native';

export type Lang = 'fr' | 'en';

/**
 * Détecte la langue du système sans expo-localization.
 * Retourne 'fr' si la locale commence par 'fr', 'en' sinon.
 */
export function getSystemLocale(): Lang {
  try {
    let tag: string | undefined;

    if (Platform.OS === 'web') {
      // Web standard
      tag = (typeof navigator !== 'undefined' && navigator.language) || undefined;
    } else {
      // React Native : NativeModules.SettingsManager (iOS) ou NativeModules.I18nManager (Android)
      // ou Intl (disponible depuis Hermes/RN 0.73+)
      const ios = NativeModules.SettingsManager?.settings?.AppleLocale
        ?? NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
      const android = NativeModules.I18nManager?.localeIdentifier;
      tag = ios ?? android;

      // Fallback Intl si disponible
      if (!tag && typeof Intl !== 'undefined') {
        tag = Intl.DateTimeFormat().resolvedOptions().locale;
      }
    }

    if (tag && tag.startsWith('fr')) return 'fr';
    if (tag && tag.startsWith('en')) return 'en';
    // Autre langue → 'fr' par défaut (app ciblant marché francophone)
    return 'fr';
  } catch {
    return 'fr';
  }
}
