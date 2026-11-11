// ============================================================
// DÉBLOCAGE DES MUSIQUES — logique pure (Progression v2, C8 / D11 / Lot 8)
//
// Chaque titre non gratuit se débloque par :
//   - { type: 'chapter', chapter: N }  : la fin du chapitre N (7 titres, un par chapitre) ;
//   - { type: 'trophy', id }           : un trophée précis, le palier « pierre » de 5 séries ;
//   - { type: 'seeds', cost }          : prévu pour plus tard, NON utilisé aujourd'hui.
// Les 2 titres gratuits (`manor_cocktail`, `foret_mystique`) n'ont pas d'`unlock`.
//
// Ce fichier est PUR (aucune dépendance React / Zustand / audio / require de fichier son) : il décrit le
// déblocage par IDENTIFIANT de titre. Le catalogue complet (fichiers audio) est dans `music.ts`, qui s'appuie
// sur `MUSIC_UNLOCKS`. Testé par __tests__/musicUnlocks.test.ts.
// ============================================================

export type MusicUnlock =
  | { type: 'chapter'; chapter: number }
  | { type: 'trophy'; id: string }
  | { type: 'seeds'; cost: number };

/** Titres gratuits : disponibles dès le début. */
export const FREE_MUSIC_IDS: readonly string[] = ['manor_cocktail', 'foret_mystique'];

/**
 * Déblocage de chaque titre non gratuit. Attribution de la spécification (D11).
 *   Chapitres 1 à 7 : un titre chacun ; palier « pierre » (2e palier) de 5 séries : un titre chacun.
 */
export const MUSIC_UNLOCKS: Readonly<Record<string, MusicUnlock>> = {
  // ── Fins de chapitre ──────────────────────────────────────
  forest_breath:            { type: 'chapter', chapter: 1 },
  jardin_japonais:          { type: 'chapter', chapter: 2 },
  pulsation_douce:          { type: 'chapter', chapter: 3 },
  woodland_pulse:           { type: 'chapter', chapter: 4 },
  deep_sub_pulse:           { type: 'chapter', chapter: 5 },
  neo_classical_motivation: { type: 'chapter', chapter: 6 },
  elek:                     { type: 'chapter', chapter: 7 },
  // ── Palier « pierre » de 5 séries (trophée n° 2) ──────────
  swaying_groove:           { type: 'trophy', id: 'rendez_vous_2' },     // Rendez-vous
  boucle_hypnotique:        { type: 'trophy', id: 'grilles_2' },         // Grilles résolues
  lilting_swing:            { type: 'trophy', id: 'duel_2' },            // Duel : victoires
  moonlit_beach_shuffle:    { type: 'trophy', id: 'botaniste_2' },       // Botaniste
  sun_warmed_groove:        { type: 'trophy', id: 'habitue_2' },         // Habitué
};

/** Titre débloqué par la fin d'un chapitre, ou null. */
export function getMusicForChapter(chapter: number): string | null {
  for (const [trackId, unlock] of Object.entries(MUSIC_UNLOCKS)) {
    if (unlock.type === 'chapter' && unlock.chapter === chapter) return trackId;
  }
  return null;
}

/** Titre débloqué par un trophée, ou null. */
export function getMusicForTrophy(trophyId: string): string | null {
  for (const [trackId, unlock] of Object.entries(MUSIC_UNLOCKS)) {
    if (unlock.type === 'trophy' && unlock.id === trophyId) return trackId;
  }
  return null;
}

/** Un titre est-il gratuit ? */
export function isFreeMusic(trackId: string): boolean {
  return FREE_MUSIC_IDS.includes(trackId);
}

/**
 * Titres possédés : les gratuits, plus ceux dont le déblocage est atteint.
 *   - `levelsCompleted` : niveaux validés (la fin du chapitre N = 3 × N niveaux) ;
 *   - `earnedTrophies`  : identifiants des trophées obtenus ;
 *   - `unlockedIds`     : titres déjà débloqués et mémorisés (`unlockedMusicIds`), qui ne se perdent jamais.
 * Le type `seeds` n'est jamais considéré comme débloqué ici : il suppose un achat explicite, non branché.
 */
export function computeOwnedMusic(
  levelsCompleted: number,
  earnedTrophies: readonly string[] | null | undefined,
  unlockedIds: readonly string[] | null | undefined,
  catalogIds: readonly string[],
): string[] {
  const earned = new Set(earnedTrophies ?? []);
  const owned = new Set<string>(FREE_MUSIC_IDS.filter(id => catalogIds.includes(id)));
  for (const id of unlockedIds ?? []) if (catalogIds.includes(id)) owned.add(id);
  for (const id of catalogIds) {
    const unlock = MUSIC_UNLOCKS[id];
    if (!unlock) continue;
    if (unlock.type === 'chapter' && levelsCompleted >= unlock.chapter * 3) owned.add(id);
    else if (unlock.type === 'trophy' && earned.has(unlock.id)) owned.add(id);
  }
  return catalogIds.filter(id => owned.has(id));
}

/** Union de deux listes de titres débloqués (jamais de perte), sans doublon. */
export function mergeUnlockedMusic(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): string[] {
  const out: string[] = [];
  for (const list of [a, b]) for (const id of list ?? []) if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
  return out;
}

/** Condition d'un titre, pour l'affichage du panneau de musique (clé i18n + variables). */
export function describeMusicUnlock(unlock: MusicUnlock): { kind: MusicUnlock['type']; chapter?: number; trophyId?: string; cost?: number } {
  switch (unlock.type) {
    case 'chapter': return { kind: 'chapter', chapter: unlock.chapter };
    case 'trophy':  return { kind: 'trophy', trophyId: unlock.id };
    case 'seeds':   return { kind: 'seeds', cost: unlock.cost };
  }
}
