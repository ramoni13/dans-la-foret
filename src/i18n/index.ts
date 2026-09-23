// ============================================================
// i18n — hook useT() + détection de la langue système
// Langue active lue dans playerStore (réactive Zustand)
// ============================================================

import { usePlayerStore } from '../store/playerStore';
import fr from './locales/fr.json';
import en from './locales/en.json';

// Re-export Lang + getSystemLocale pour les imports externes
export type { Lang } from './locale';
export { getSystemLocale } from './locale';

const DICTIONARIES: Record<string, Record<string, string>> = { fr, en };

/**
 * Interpolation simple : remplace "{{key}}" par la valeur correspondante.
 */
function interpolate(str: string, vars?: Record<string, string>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Hook de traduction.
 * Lit la langue depuis playerStore — réactif : tout changement via setLanguage
 * provoque un re-render des composants qui utilisent useT().
 *
 * Usage :
 *   const t = useT()
 *   t('btn_play')                          // → "Jouer" ou "Play"
 *   t('a11y_no_same', { element: 'ours' }) // → "Deux ours ne peuvent pas être voisins"
 */
export function useT(): (key: string, vars?: Record<string, string>) => string {
  const language = usePlayerStore(state => state.language);
  const dict = DICTIONARIES[language] ?? DICTIONARIES.fr;

  return (key: string, vars?: Record<string, string>) => {
    const raw = dict[key] ?? (fr as Record<string, string>)[key] ?? key;
    return interpolate(raw, vars);
  };
}
