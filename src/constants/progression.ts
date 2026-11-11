// ============================================================
// PROGRESSION v2 — étoiles, seuils, chapitres, déblocages
// Référence : docs/progression-v2.md (sections C1, C2, C3)
//
// Ce fichier est PUR : aucune dépendance React, Zustand ou Firebase.
// Il est testé par __tests__/progression.test.ts.
// ============================================================

// ── Constantes générales ──────────────────────────────────────────────────────

/** Version du modèle de progression. Un profil < 2 est remis à zéro (C9). */
export const CURRENT_PROGRESSION_VERSION = 2;

/** Nombre de niveaux du jeu solo. */
export const LEVEL_COUNT = 21;

/** Nombre de défis par niveau (donc 30 étoiles possibles par niveau). */
export const CHALLENGES_PER_LEVEL = 10;

/** Maximum d'étoiles par défi. */
export const MAX_STARS_PER_CHALLENGE = 3;

/** Maximum d'étoiles par niveau (10 défis × 3). */
export const MAX_STARS_PER_LEVEL = CHALLENGES_PER_LEVEL * MAX_STARS_PER_CHALLENGE;

/** Graines gagnées par NOUVELLE étoile sur un défi rejoué (C2). */
export const SEEDS_PER_NEW_STAR = 5;

/** Graines d'un profil neuf ou remis à zéro (C9). */
export const INITIAL_SEEDS = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Note d'un défi gagné. 0 (jamais gagné) n'est pas stocké : absence de clé. */
export type StarRating = 1 | 2 | 3;

export interface ComputeStarsInput {
  /** Nombre de validations ratées pendant la partie. */
  failCount: number;
  /** Nombre de bonus utilisés pendant la partie. */
  bonusUsedCount: number;
  /** Nombre de jetons posés puis déplacés, retirés ou remplacés. */
  elementChangeCount: number;
}

export interface LevelProgress {
  /** Niveau jouable le plus haut : 1 + niveaux consécutifs validés, max 21. */
  currentLevel: number;
  /** Niveaux consécutifs validés depuis le niveau 1 (0 à 21). */
  levelsCompleted: number;
  /** Étoiles par niveau, clés 1 à 21 toujours présentes (0 si rien). */
  starsByLevel: Record<number, number>;
}

// ── Seuils d'étoiles (C1 / D1) ────────────────────────────────────────────────
// Niveau N+1 ouvert si étoiles(N) >= seuil(N), sur 30 possibles.
//   6 ⭐ : niveaux qui introduisent une règle (1, 3, 5, 7, 9, 11, 12, 17, 19)
//   6 ⭐ : épreuves sans bonus (15, 18, 21)
//   4 ⭐ : tous les autres niveaux

export const STAR_THRESHOLDS: Readonly<Record<number, number>> = {
  1: 6,  2: 4,  3: 6,  4: 4,  5: 6,  6: 4,  7: 6,
  8: 4,  9: 6,  10: 4, 11: 6, 12: 6, 13: 4, 14: 4,
  15: 6, 16: 4, 17: 6, 18: 6, 19: 6, 20: 4, 21: 6,
};

/** Seuil d'étoiles du niveau `level` (1 à 21), ou null si le niveau n'existe pas. */
export function getStarThreshold(level: number): number | null {
  return STAR_THRESHOLDS[level] ?? null;
}

// ── Étoiles d'un défi (C1) ────────────────────────────────────────────────────

/**
 * Note d'un défi gagné :
 *   ⭐   victoire
 *   ⭐⭐  aucune validation ratée
 *   ⭐⭐⭐ aucune validation ratée + aucun bonus + aucun jeton déplacé/retiré/remplacé
 * Le critère « jamais abandonné » n'existe plus.
 */
export function computeStars(input: ComputeStarsInput): StarRating {
  if (input.failCount > 0) return 1;
  if (input.bonusUsedCount > 0 || input.elementChangeCount > 0) return 2;
  return 3;
}

// ── Identifiants de défis solo ────────────────────────────────────────────────

const SOLO_CHALLENGE_ID = /^niveau_(\d{1,2})_(\d{3})$/;

/**
 * Niveau (1 à 21) d'un identifiant de défi solo `niveau_N_NNN`, ou null.
 * Les défis Forestier (`onf_4x4_NNN`) et tout identifiant invalide donnent null.
 * Le numéro de défi doit être compris entre 1 et 10.
 */
export function getLevelFromChallengeId(challengeId: string): number | null {
  const m = SOLO_CHALLENGE_ID.exec(challengeId);
  if (!m) return null;
  const level = parseInt(m[1], 10);
  const num = parseInt(m[2], 10);
  if (level < 1 || level > LEVEL_COUNT) return null;
  if (num < 1 || num > CHALLENGES_PER_LEVEL) return null;
  return level;
}

function isStarRating(value: unknown): value is StarRating {
  return value === 1 || value === 2 || value === 3;
}

// ── Version de progression (C9) ───────────────────────────────────────────────

/** true si la version du profil est la version courante (pas de remise à zéro à faire). */
export function isProgressionCurrent(version: number | null | undefined): boolean {
  return typeof version === 'number' && version >= CURRENT_PROGRESSION_VERSION;
}

/** true si un profil de cette version doit être remis à zéro (version absente ou < 2). */
export function needsProgressionReset(version: number | null | undefined): boolean {
  return !isProgressionCurrent(version);
}

// ── Niveau : ancien calcul (pré-v2) ───────────────────────────────────────────

/**
 * ANCIEN calcul du niveau : 1 niveau par tranche de 10 défis uniques complétés,
 * plafonné à 21. Conservé uniquement tant que PROGRESSION_V2 est désactivé.
 */
export function computeLegacyLevel(completedCount: number): number {
  return Math.min(LEVEL_COUNT, Math.floor(completedCount / CHALLENGES_PER_LEVEL) + 1);
}

/**
 * Niveau courant du joueur.
 *   useStars = true  → niveau dérivé des étoiles (Progression v2) ;
 *   useStars = false → ancien calcul par nombre de défis complétés.
 * Le drapeau PROGRESSION_V2 est passé par l'appelant pour garder ce fichier pur.
 */
export function resolvePlayerLevel(
  useStars: boolean,
  challengeStars: Record<string, number> | null | undefined,
  completedCount: number,
): number {
  return useStars
    ? computeLevelProgress(challengeStars).currentLevel
    : computeLegacyLevel(completedCount);
}

// ── Progression par niveau (C1) ───────────────────────────────────────────────

/**
 * Calcule la progression depuis les meilleures notes.
 * Robuste aux données corrompues : les identifiants invalides et les notes
 * hors 1-3 sont ignorés.
 */
export function computeLevelProgress(
  challengeStars: Record<string, number> | null | undefined,
): LevelProgress {
  const starsByLevel: Record<number, number> = {};
  for (let level = 1; level <= LEVEL_COUNT; level++) starsByLevel[level] = 0;

  for (const [challengeId, stars] of Object.entries(challengeStars ?? {})) {
    const level = getLevelFromChallengeId(challengeId);
    if (level === null || !isStarRating(stars)) continue;
    starsByLevel[level] += stars;
  }

  let levelsCompleted = 0;
  while (
    levelsCompleted < LEVEL_COUNT &&
    starsByLevel[levelsCompleted + 1] >= STAR_THRESHOLDS[levelsCompleted + 1]
  ) {
    levelsCompleted++;
  }

  return {
    currentLevel: Math.min(LEVEL_COUNT, levelsCompleted + 1),
    levelsCompleted,
    starsByLevel,
  };
}

/** Total d'étoiles (tous niveaux). */
export function countTotalStars(challengeStars: Record<string, number> | null | undefined): number {
  const { starsByLevel } = computeLevelProgress(challengeStars);
  let total = 0;
  for (let level = 1; level <= LEVEL_COUNT; level++) total += starsByLevel[level];
  return total;
}

/** Nombre de défis à ⭐⭐⭐. */
export function countThreeStarChallenges(
  challengeStars: Record<string, number> | null | undefined,
): number {
  let count = 0;
  for (const [challengeId, stars] of Object.entries(challengeStars ?? {})) {
    if (getLevelFromChallengeId(challengeId) !== null && stars === 3) count++;
  }
  return count;
}

// ── Enregistrement d'une victoire solo (meilleure note, graines, compteurs) ──

export interface SoloSeedsInput {
  /** true si c'est la première victoire sur ce défi. */
  isFirstWin: boolean;
  /** Graines de base (`calculateSeedReward`), versées à la première victoire. */
  baseSeeds: number;
  /** Meilleure note avant cette partie (0 si jamais gagné). */
  previousStars: number;
  /** Note de cette partie. */
  newStars: StarRating;
}

/** Nombre d'étoiles NOUVELLES apportées par cette partie (jamais négatif). */
export function getGainedStars(previousStars: number, newStars: number): number {
  return Math.max(0, newStars - previousStars);
}

/**
 * Graines d'une victoire solo (C2).
 *   - première victoire : `baseSeeds` (PERFECT ×2 géré par l'écran si ⭐⭐⭐) ;
 *   - défi rejoué : SEEDS_PER_NEW_STAR par NOUVELLE étoile, sinon 0.
 */
export function computeSoloSeeds(input: SoloSeedsInput): number {
  if (input.isFirstWin) return Math.max(0, input.baseSeeds);
  return getGainedStars(input.previousStars, input.newStars) * SEEDS_PER_NEW_STAR;
}

export interface StarResultInput {
  challengeStars: Record<string, number>;
  challengeId: string;
  stars: StarRating;
  /** Le défi figurait déjà dans `completedChallenges` avant cette partie. */
  alreadyCompleted: boolean;
  elapsedMs: number;
  /** Durée estimée du défi en ms (pour « Vif comme le vent »). */
  estimatedDurationMs?: number;
  // Compteurs de trophées avant cette partie
  starStreak: number;
  quickFirstWins: number;
  improvedStarChallengeIds: string[];
}

export interface StarResult {
  /** Meilleures notes mises à jour (ne baissent jamais). */
  challengeStars: Record<string, StarRating>;
  /** Meilleure note avant cette partie (0 si jamais gagné). */
  previousStars: number;
  /** Meilleure note après cette partie. */
  bestStars: StarRating;
  /** Étoiles nouvelles apportées par cette partie. */
  gainedStars: number;
  isFirstWin: boolean;
  /** La note s'est améliorée sur un défi déjà gagné avec une note. */
  improved: boolean;
  /** Compteurs de trophées mis à jour. */
  starStreak: number;
  quickFirstWins: number;
  improvedStarChallengeIds: string[];
  progressBefore: LevelProgress;
  progressAfter: LevelProgress;
  /** Nombre de niveaux nouvellement validés par cette partie (0 le plus souvent). */
  levelsNewlyCompleted: number;
}

/**
 * Applique une victoire solo : meilleure note, compteurs de trophées, progression.
 *   - la note stockée est le MAX de l'ancienne et de la nouvelle ;
 *   - `starStreak` (Œil de lynx) et `quickFirstWins` (Vif comme le vent) ne
 *     bougent qu'à la PREMIÈRE victoire d'un défi ;
 *   - `improvedStarChallengeIds` (Persévérant) = défis distincts dont la note a progressé.
 */
export function applyStarResult(input: StarResultInput): StarResult {
  const stored = input.challengeStars[input.challengeId];
  const previousStars = isStarRating(stored) ? stored : 0;
  const isFirstWin = !input.alreadyCompleted && previousStars === 0;
  const bestStars: StarRating = (previousStars > input.stars ? previousStars : input.stars) as StarRating;
  const gainedStars = getGainedStars(previousStars, input.stars);

  const challengeStars: Record<string, StarRating> = {};
  for (const [id, value] of Object.entries(input.challengeStars)) {
    if (isStarRating(value)) challengeStars[id] = value;
  }
  challengeStars[input.challengeId] = bestStars;

  const improved = previousStars > 0 && input.stars > previousStars;
  const improvedStarChallengeIds =
    improved && !input.improvedStarChallengeIds.includes(input.challengeId)
      ? [...input.improvedStarChallengeIds, input.challengeId]
      : input.improvedStarChallengeIds;

  let starStreak = input.starStreak;
  let quickFirstWins = input.quickFirstWins;
  if (isFirstWin) {
    starStreak = input.stars >= 2 ? starStreak + 1 : 0;
    if (
      input.estimatedDurationMs !== undefined &&
      input.estimatedDurationMs > 0 &&
      input.elapsedMs < input.estimatedDurationMs * 0.5
    ) {
      quickFirstWins += 1;
    }
  }

  const progressBefore = computeLevelProgress(input.challengeStars);
  const progressAfter = computeLevelProgress(challengeStars);

  return {
    challengeStars,
    previousStars,
    bestStars,
    gainedStars,
    isFirstWin,
    improved,
    starStreak,
    quickFirstWins,
    improvedStarChallengeIds,
    progressBefore,
    progressAfter,
    levelsNewlyCompleted: Math.max(0, progressAfter.levelsCompleted - progressBefore.levelsCompleted),
  };
}

/**
 * Fusion local + cloud des meilleures notes : max par défi.
 * Les étoiles ne baissent jamais, même après une synchronisation.
 */
export function mergeChallengeStars(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined,
): Record<string, StarRating> {
  const merged: Record<string, StarRating> = {};
  for (const source of [a, b]) {
    for (const [id, value] of Object.entries(source ?? {})) {
      if (!isStarRating(value)) continue;
      const current = merged[id] ?? 0;
      if (value > current) merged[id] = value;
    }
  }
  return merged;
}

// ── Chapitres, rangs, récompenses (C3) ────────────────────────────────────────

export type ProgressionFeature =
  | 'duel'
  | 'onf_sentier'
  | 'onf_clairiere'
  | 'onf_profonde'
  | 'daily_pousse'
  | 'daily_grand_chene'
  | 'herbier_europe'
  | 'herbier_monde'
  | 'herbier_remarquables';

export type HerbierRegion = 'france' | 'europe' | 'monde' | 'remarquables';

/** Récompense de fin de chapitre. Typée pour que les cérémonies (Lot 4) les affichent toutes. */
export type ChapterReward =
  | { type: 'seeds'; amount: number }
  | { type: 'feature'; feature: ProgressionFeature }
  /** Une carte d'arbre offerte ; `legendary` au chapitre 7. */
  | { type: 'tree_card'; legendary?: boolean }
  /** Titre musical du chapitre (attribution : Lot 8, modèle `unlock` du catalogue). */
  | { type: 'music'; chapter: number }
  | { type: 'herbier_region'; region: HerbierRegion }
  | { type: 'trophy'; id: string };

export interface Chapter {
  /** 1 à 7. */
  id: number;
  /** Premier et dernier niveau du chapitre. */
  levels: readonly [number, number];
  emoji: string;
  /** Clés i18n (présentes dans fr.json et en.json). */
  nameKey: string;
  rankKey: string;
  /** Identifiant du rang affiché pendant le chapitre (promeneur… esprit_foret). */
  rankId: string;
  rewards: readonly ChapterReward[];
}

/** Trophée final, décerné à la fin du chapitre 7 (attribué au Lot 8). */
export const FINAL_TROPHY_ID = 'esprit_accompli';

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 1, levels: [1, 3], emoji: '🌱',
    nameKey: 'progression_chapter_1_name', rankKey: 'progression_rank_1', rankId: 'promeneur',
    rewards: [
      { type: 'seeds', amount: 10 },
      { type: 'feature', feature: 'duel' },
      { type: 'tree_card' },
      { type: 'music', chapter: 1 },
    ],
  },
  {
    id: 2, levels: [4, 6], emoji: '🐺',
    nameKey: 'progression_chapter_2_name', rankKey: 'progression_rank_2', rankId: 'bucheron',
    rewards: [
      { type: 'seeds', amount: 25 },
      { type: 'feature', feature: 'onf_sentier' },
      { type: 'tree_card' },
      { type: 'music', chapter: 2 },
    ],
  },
  {
    id: 3, levels: [7, 9], emoji: '🐝',
    nameKey: 'progression_chapter_3_name', rankKey: 'progression_rank_3', rankId: 'sylviculteur',
    rewards: [
      { type: 'seeds', amount: 50 },
      { type: 'feature', feature: 'daily_pousse' },
      { type: 'feature', feature: 'onf_clairiere' },
      { type: 'tree_card' },
      { type: 'music', chapter: 3 },
    ],
  },
  {
    id: 4, levels: [10, 12], emoji: '🏡',
    nameKey: 'progression_chapter_4_name', rankKey: 'progression_rank_4', rankId: 'garde_forestier',
    rewards: [
      { type: 'seeds', amount: 100 },
      { type: 'feature', feature: 'daily_grand_chene' },
      { type: 'feature', feature: 'onf_profonde' },
      { type: 'tree_card' },
      { type: 'music', chapter: 4 },
    ],
  },
  {
    id: 5, levels: [13, 15], emoji: '🏔️',
    nameKey: 'progression_chapter_5_name', rankKey: 'progression_rank_5', rankId: 'technicien_onf',
    rewards: [
      { type: 'seeds', amount: 200 },
      { type: 'feature', feature: 'herbier_europe' },
      { type: 'herbier_region', region: 'europe' },
      { type: 'tree_card' },
      { type: 'music', chapter: 5 },
    ],
  },
  {
    id: 6, levels: [16, 18], emoji: '🌲',
    nameKey: 'progression_chapter_6_name', rankKey: 'progression_rank_6', rankId: 'ingenieur_forets',
    rewards: [
      { type: 'seeds', amount: 500 },
      { type: 'feature', feature: 'herbier_monde' },
      { type: 'herbier_region', region: 'monde' },
      { type: 'tree_card' },
      { type: 'music', chapter: 6 },
    ],
  },
  {
    id: 7, levels: [19, 21], emoji: '✨',
    nameKey: 'progression_chapter_7_name', rankKey: 'progression_rank_7', rankId: 'esprit_foret',
    rewards: [
      { type: 'feature', feature: 'herbier_remarquables' },
      { type: 'herbier_region', region: 'remarquables' },
      { type: 'tree_card', legendary: true },
      { type: 'music', chapter: 7 },
      { type: 'trophy', id: FINAL_TROPHY_ID },
    ],
  },
];

/** Chapitre (1 à 7) qui contient le niveau `level`, ou null si le niveau n'existe pas. */
export function getChapterForLevel(level: number): Chapter | null {
  return CHAPTERS.find(c => level >= c.levels[0] && level <= c.levels[1]) ?? null;
}

/** Chapitre par numéro (1 à 7), ou null. */
export function getChapter(chapterId: number): Chapter | null {
  return CHAPTERS.find(c => c.id === chapterId) ?? null;
}

/** Chapitre en cours = chapitre du niveau jouable le plus haut (rang affiché). */
export function getCurrentChapter(progress: Pick<LevelProgress, 'currentLevel'>): Chapter {
  return getChapterForLevel(progress.currentLevel) ?? CHAPTERS[CHAPTERS.length - 1];
}

/**
 * Chapitre terminé = tous ses niveaux validés (seuil d'étoiles atteint).
 * Les niveaux se validant dans l'ordre, cela revient à
 * `levelsCompleted >= dernier niveau du chapitre`.
 */
export function isChapterCompleted(
  chapterId: number,
  progress: Pick<LevelProgress, 'levelsCompleted'>,
): boolean {
  const chapter = getChapter(chapterId);
  if (!chapter) return false;
  return progress.levelsCompleted >= chapter.levels[1];
}

/** Chapitres terminés, dans l'ordre. */
export function getCompletedChapters(
  progress: Pick<LevelProgress, 'levelsCompleted'>,
): Chapter[] {
  return CHAPTERS.filter(c => isChapterCompleted(c.id, progress));
}

function buildFeatureUnlockMap(): Record<ProgressionFeature, number> {
  const map = {} as Record<ProgressionFeature, number>;
  for (const chapter of CHAPTERS) {
    for (const reward of chapter.rewards) {
      if (reward.type === 'feature') map[reward.feature] = chapter.id;
    }
  }
  return map;
}

/** Chapitre dont la fin débloque chaque fonctionnalité. Dérivé de `CHAPTERS`. */
export const FEATURE_UNLOCK_CHAPTER: Readonly<Record<ProgressionFeature, number>> = buildFeatureUnlockMap();

export const ALL_FEATURES = Object.keys(FEATURE_UNLOCK_CHAPTER) as ProgressionFeature[];

/** Une fonctionnalité est ouverte quand le chapitre qui la débloque est terminé. */
export function isFeatureUnlocked(
  feature: ProgressionFeature,
  progress: Pick<LevelProgress, 'levelsCompleted'>,
): boolean {
  const chapterId = FEATURE_UNLOCK_CHAPTER[feature];
  if (chapterId === undefined) return false;
  return isChapterCompleted(chapterId, progress);
}

// ============================================================
// LOT 2 — Interface des étoiles : aides pures d'affichage
// ============================================================

// ── Défis d'un niveau ─────────────────────────────────────────────────────────

/** Identifiant du défi `number` (1 à 10) du niveau `level`. Ex. (3, 7) → `niveau_3_007`. */
export function buildChallengeId(level: number, number: number): string {
  return `niveau_${level}_${String(number).padStart(3, '0')}`;
}

/** Les 10 identifiants de défis d'un niveau, dans l'ordre. */
export function getLevelChallengeIds(level: number): string[] {
  return Array.from({ length: CHALLENGES_PER_LEVEL }, (_, i) => buildChallengeId(level, i + 1));
}

// ── Niveau ouvert ? (C1 : N+1 ouvert si étoiles(N) >= seuil(N)) ───────────────

/**
 * Un niveau est ouvert si tous les niveaux précédents sont validés
 * (`levelsCompleted >= level - 1`). Le niveau 1 est toujours ouvert.
 */
export function isLevelOpen(level: number, progress: Pick<LevelProgress, 'levelsCompleted'>): boolean {
  if (level < 1 || level > LEVEL_COUNT) return false;
  return progress.levelsCompleted >= level - 1;
}

// ── État d'un niveau pour l'écran de sélection ───────────────────────────────

export interface LevelStatus {
  level: number;
  isOpen: boolean;
  /** Seuil de validation (étoiles requises). */
  threshold: number;
  /** Étoiles obtenues dans ce niveau (0 à 30). */
  stars: number;
  /** Étoiles comptées dans la jauge, plafonnées au seuil (affichage `x / seuil`). */
  starsShown: number;
  /** Étoiles encore nécessaires pour valider (0 si validé). */
  starsMissing: number;
  /** Niveau validé : seuil atteint. */
  isCompleted: boolean;
  /** Défis gagnés (au moins ⭐) / total. */
  challengesWon: number;
  challengesTotal: number;
  /** Fraction de la jauge, 0 à 1. */
  ratio: number;
}

export function getLevelStatus(
  level: number,
  challengeStars: Record<string, number> | null | undefined,
  progress?: LevelProgress,
): LevelStatus {
  const p = progress ?? computeLevelProgress(challengeStars);
  const threshold = STAR_THRESHOLDS[level] ?? 0;
  const stars = p.starsByLevel[level] ?? 0;
  const starsShown = Math.min(stars, threshold);
  let challengesWon = 0;
  for (const id of getLevelChallengeIds(level)) {
    const v = (challengeStars ?? {})[id];
    if (v === 1 || v === 2 || v === 3) challengesWon++;
  }
  return {
    level,
    isOpen: isLevelOpen(level, p),
    threshold,
    stars,
    starsShown,
    starsMissing: Math.max(0, threshold - stars),
    isCompleted: threshold > 0 && stars >= threshold && isLevelOpen(level, p),
    challengesWon,
    challengesTotal: CHALLENGES_PER_LEVEL,
    ratio: threshold > 0 ? Math.min(1, stars / threshold) : 0,
  };
}

// ── « Prochain conseillé » (C1 / D13) ────────────────────────────────────────

/**
 * Défi à mettre en avant dans un niveau ouvert :
 *   1. le premier défi JAMAIS gagné ;
 *   2. sinon le premier défi sans ⭐⭐⭐ ;
 *   3. sinon null (niveau parfait : 10 × ⭐⭐⭐).
 */
export function getRecommendedChallengeId(
  level: number,
  challengeStars: Record<string, number> | null | undefined,
): string | null {
  const ids = getLevelChallengeIds(level);
  const stars = challengeStars ?? {};
  const neverWon = ids.find(id => !(stars[id] === 1 || stars[id] === 2 || stars[id] === 3));
  if (neverWon) return neverWon;
  return ids.find(id => stars[id] !== 3) ?? null;
}

/**
 * « Prochain conseillé » global : dans le niveau jouable le plus haut, sinon
 * (niveau parfait) on remonte vers le niveau précédent le plus récent qui a encore
 * un défi sans ⭐⭐⭐. Retourne null si les 210 défis sont à ⭐⭐⭐.
 */
export function getNextRecommended(
  challengeStars: Record<string, number> | null | undefined,
): { level: number; challengeId: string } | null {
  const { currentLevel } = computeLevelProgress(challengeStars);
  for (let level = currentLevel; level >= 1; level--) {
    const id = getRecommendedChallengeId(level, challengeStars);
    if (id) return { level, challengeId: id };
  }
  return null;
}

// ── Séquence d'animation des étoiles (VictoryModal, C7) ──────────────────────

/** Critère écrit sous chaque emplacement d'étoile (clés i18n). */
export const STAR_CRITERIA_KEYS = [
  'victory_star_criterion_1', // Gagné
  'victory_star_criterion_2', // Sans erreur
  'victory_star_criterion_3', // Parfait
] as const;

export type StarSlotState =
  /** Étoile obtenue et NOUVELLE : brille, s'envole vers le compteur. */
  | 'new'
  /** Étoile déjà acquise lors d'une partie précédente : pâle, ne vole pas. */
  | 'owned'
  /** Étoile non obtenue cette fois (et jamais auparavant) : grise, critère visible. */
  | 'missed';

export interface StarSequence {
  /** Un état par emplacement (3). */
  slots: [StarSlotState, StarSlotState, StarSlotState];
  /** Nombre d'étoiles qui pop et s'envolent (= étoiles nouvelles). */
  newCount: number;
  /** Étoiles gagnées cette partie (1 à 3), nouvelles ou non. */
  earnedStars: StarRating;
  /** Meilleure note après la partie. */
  bestStars: StarRating;
}

/**
 * Découpe une partie en 3 emplacements.
 *   - emplacement i < earned : obtenu cette fois ;
 *       · i >= previousStars → NOUVELLE (brille et vole) ;
 *       · i <  previousStars → déjà acquise (pâle, ne vole pas).
 *   - emplacement i >= earned : non obtenu cette fois ;
 *       · si déjà acquis avant (i < previousStars) → reste pâle (« owned ») : les étoiles
 *         ne baissent jamais ;
 *       · sinon → grise (« missed »).
 */
export function buildStarSequence(earnedStars: StarRating, previousStars: number): StarSequence {
  const prev = Math.max(0, Math.min(3, Math.floor(previousStars)));
  const slots: StarSlotState[] = [];
  for (let i = 0; i < MAX_STARS_PER_CHALLENGE; i++) {
    if (i < earnedStars) slots.push(i >= prev ? 'new' : 'owned');
    else slots.push(i < prev ? 'owned' : 'missed');
  }
  const best = Math.max(prev, earnedStars) as StarRating;
  return {
    slots: slots as StarSequence['slots'],
    newCount: slots.filter(s => s === 'new').length,
    earnedStars,
    bestStars: best,
  };
}

// Timings (ms) : la séquence complète dure moins de 2 s (C7). Resserrés après essai : la première étoile
// apparaît presque aussitôt et l'envol vers le compteur ⭐ démarre dès son pop.
export const STAR_POP_INTERVAL_MS = 260;
export const STAR_FIRST_POP_DELAY_MS = 120;
export const STAR_GAUGE_DELAY_MS = 150;
export const STAR_SEQUENCE_TARGET_MS = 2500;

/**
 * Délai (ms) avant le pop de chaque emplacement. Les étoiles « owned » / « missed » sont
 * posées immédiatement (délai 0) : seules les étoiles nouvelles se succèdent.
 */
export function getStarPopDelays(seq: StarSequence): number[] {
  let k = 0;
  return seq.slots.map(s => {
    if (s !== 'new') return 0;
    const d = STAR_FIRST_POP_DELAY_MS + k * STAR_POP_INTERVAL_MS;
    k++;
    return d;
  });
}

/** Durée totale de la séquence d'étoiles + jauge (ms), bornée par STAR_SEQUENCE_TARGET_MS. */
export function getStarSequenceDuration(seq: StarSequence): number {
  if (seq.newCount === 0) return STAR_FIRST_POP_DELAY_MS + STAR_GAUGE_DELAY_MS;
  const lastPop = STAR_FIRST_POP_DELAY_MS + (seq.newCount - 1) * STAR_POP_INTERVAL_MS;
  return Math.min(STAR_SEQUENCE_TARGET_MS, lastPop + 300 + STAR_GAUGE_DELAY_MS);
}

/**
 * Fréquence relative de la note du pop `k` (0, 1, 2) : de plus en plus aiguë.
 * Gamme pentatonique majeure (do, mi, sol) en rapports de hauteur par rapport à la 1re note.
 */
export const STAR_NOTE_RATES = [1, 1.2599, 1.4983] as const;

export type StarHaptic = 'light' | 'medium';

/** Vibration du pop `k` : légère pour les deux premiers, moyenne pour la 3e étoile. */
export function getStarHaptic(starIndex: number): StarHaptic {
  return starIndex >= 2 ? 'medium' : 'light';
}

// ── Bandeau « Niveau N débloqué » et jauge ───────────────────────────────────

export interface LevelGaugeResult {
  level: number;
  starsBefore: number;
  starsAfter: number;
  threshold: number;
  /** La jauge affichée passe de before à after (plafonnée au seuil). */
  shownBefore: number;
  shownAfter: number;
  /** Le seuil vient d'être franchi par cette partie. */
  justCompleted: boolean;
  /** Niveau qui vient de s'ouvrir (N + 1), ou null. Null après le niveau 21. */
  unlockedLevel: number | null;
}

/**
 * Jauge `x / seuil` du niveau du défi joué, et signal « Niveau N débloqué ! ».
 * `before` / `after` : meilleures notes AVANT et APRÈS la partie.
 */
export function getLevelGaugeResult(
  level: number,
  before: Record<string, number> | null | undefined,
  after: Record<string, number> | null | undefined,
): LevelGaugeResult {
  const pb = computeLevelProgress(before);
  const pa = computeLevelProgress(after);
  const threshold = STAR_THRESHOLDS[level] ?? 0;
  const starsBefore = pb.starsByLevel[level] ?? 0;
  const starsAfter = pa.starsByLevel[level] ?? 0;
  const justCompleted = threshold > 0 && starsBefore < threshold && starsAfter >= threshold;
  return {
    level,
    starsBefore,
    starsAfter,
    threshold,
    shownBefore: Math.min(starsBefore, threshold),
    shownAfter: Math.min(starsAfter, threshold),
    justCompleted,
    unlockedLevel: justCompleted && level < LEVEL_COUNT && pa.levelsCompleted >= level ? level + 1 : null,
  };
}

// ── « Défi suivant » après une victoire (Solo) ───────────────────────────────

/**
 * Prochain défi à jouer dans le MÊME niveau, hors défi qu'on vient de jouer :
 * jamais gagné d'abord, puis premier sans ⭐⭐⭐. null si le niveau n'a plus rien à proposer.
 */
export function getNextInLevel(
  level: number,
  playedChallengeId: string,
  challengeStars: Record<string, number> | null | undefined,
): string | null {
  const ids = getLevelChallengeIds(level);
  const stars = challengeStars ?? {};
  const won = (id: string) => stars[id] === 1 || stars[id] === 2 || stars[id] === 3;
  const neverWon = ids.find(id => id !== playedChallengeId && !won(id));
  if (neverWon) return neverWon;
  return ids.find(id => id !== playedChallengeId && stars[id] !== 3) ?? null;
}

/** Destination d'un bouton de la VictoryModal Solo. */
export type VictoryTarget =
  | { kind: 'challenge'; challengeId: string; level: number }
  | { kind: 'home' };

export interface VictoryNavigation {
  /** Bouton principal. `label` indique ce qu'il fait au joueur. */
  primary: VictoryTarget;
  primaryLabel: 'next_challenge' | 'next_level' | 'ceremony';
  /** Niveau annoncé par le bouton « next_level » (sinon null). */
  primaryLevel: number | null;
  /** Bouton secondaire « Continuer le niveau N » (étoiles manquantes), ou null. */
  secondary: { challengeId: string; level: number } | null;
}

/**
 * Boutons de la VictoryModal Solo (Progression v2) :
 *   - le niveau vient d'être VALIDÉ et le niveau suivant est ouvert : bouton principal → niveau suivant,
 *     bouton secondaire → continuer le niveau pour les étoiles manquantes (s'il en reste) ;
 *   - sinon : comportement « Défi suivant » historique (`getNextAfterWin`), pas de secondaire ;
 *   - une cérémonie est EN FILE : le bouton principal ramène à l'accueil, où elle se joue (jamais sur
 *     l'écran de jeu, règle C7). Le bouton secondaire, lui, reste un choix explicite du joueur.
 * `challengeStars` : meilleures notes APRÈS la partie. `unlockedLevel` : `gauge.unlockedLevel`.
 */
export function getVictoryNavigation(input: {
  level: number;
  playedChallengeId: string;
  challengeStars: Record<string, number> | null | undefined;
  unlockedLevel: number | null;
  ceremonyPending: boolean;
}): VictoryNavigation {
  const { level, playedChallengeId, challengeStars, unlockedLevel, ceremonyPending } = input;
  const stars = challengeStars ?? {};

  let primary: VictoryTarget;
  let primaryLabel: VictoryNavigation['primaryLabel'] = 'next_challenge';
  let primaryLevel: number | null = null;
  let secondary: VictoryNavigation['secondary'] = null;

  if (unlockedLevel !== null && isLevelOpen(unlockedLevel, computeLevelProgress(stars))) {
    const target = getRecommendedChallengeId(unlockedLevel, stars) ?? getLevelChallengeIds(unlockedLevel)[0];
    primary = { kind: 'challenge', challengeId: target, level: unlockedLevel };
    primaryLabel = 'next_level';
    primaryLevel = unlockedLevel;
    const rest = getNextInLevel(level, playedChallengeId, stars);
    if (rest) secondary = { challengeId: rest, level };
  } else {
    const next = getNextAfterWin(level, playedChallengeId, stars);
    if (next) {
      const nextLevel = getLevelFromChallengeId(next) ?? level;
      primary = { kind: 'challenge', challengeId: next, level: nextLevel };
    } else {
      primary = { kind: 'home' };
    }
  }

  if (ceremonyPending) {
    primary = { kind: 'home' };
    primaryLabel = 'ceremony';
    primaryLevel = null;
  }
  return { primary, primaryLabel, primaryLevel, secondary };
}

/**
 * Défi vers lequel mène le bouton « Défi suivant ».
 *   1. le prochain conseillé du MÊME niveau (hors défi qu'on vient de jouer) ;
 *   2. sinon, si le niveau suivant est ouvert, son prochain conseillé ;
 *   3. sinon null → retour à l'accueil (rien à proposer, ou niveau suivant encore fermé).
 * `challengeStars` doit être la note APRÈS la partie.
 */
export function getNextAfterWin(
  level: number,
  playedChallengeId: string,
  challengeStars: Record<string, number> | null | undefined,
): string | null {
  const stars = challengeStars ?? {};

  // 1. Jamais gagné d'abord, puis premier sans ⭐⭐⭐ — toujours hors défi joué
  const sameLevel = getNextInLevel(level, playedChallengeId, stars);
  if (sameLevel) return sameLevel;

  // 2. Niveau suivant, s'il est ouvert
  if (level < LEVEL_COUNT) {
    const progress = computeLevelProgress(stars);
    if (isLevelOpen(level + 1, progress)) {
      return getRecommendedChallengeId(level + 1, stars) ?? getLevelChallengeIds(level + 1)[0];
    }
  }
  return null;
}

// ============================================================
// LOT 3 — Rang = chapitre, graines de fin de chapitre, état des chapitres
// ============================================================

// ── Rang = chapitre en cours (D4) ─────────────────────────────────────────────

/** Libellés FR / EN du rang de chaque chapitre (identiques à `progression_rank_N` dans les JSON i18n). */
export const CHAPTER_RANK_LABELS: Readonly<Record<number, { fr: string; en: string }>> = {
  1: { fr: 'Promeneur',                  en: 'Wanderer' },
  2: { fr: 'Bûcheron',                   en: 'Lumberjack' },
  3: { fr: 'Sylviculteur',               en: 'Silviculturist' },
  4: { fr: 'Garde Forestier',            en: 'Forest Ranger' },
  5: { fr: 'Technicien Planète Urgence', en: 'Planète Urgence Technician' },
  6: { fr: 'Ingénieur des Forêts',       en: 'Forest Engineer' },
  7: { fr: 'Esprit de la Forêt',         en: 'Spirit of the Forest' },
};

export interface ChapterRank {
  chapterId: number;
  rankId: string;
  /** Clé i18n du rang. */
  rankKey: string;
  /** Emblème du chapitre, utilisé comme icône du rang. */
  emoji: string;
  labelFr: string;
  labelEn: string;
}

/**
 * Rang affiché pour un niveau : celui du chapitre qui le contient.
 * Un niveau hors plage est ramené dans [1, 21].
 */
export function getRankForLevel(level: number): ChapterRank {
  const clamped = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(Number.isFinite(level) ? level : 1)));
  const chapter = getChapterForLevel(clamped) ?? CHAPTERS[0];
  const labels = CHAPTER_RANK_LABELS[chapter.id];
  return {
    chapterId: chapter.id,
    rankId: chapter.rankId,
    rankKey: chapter.rankKey,
    emoji: chapter.emoji,
    labelFr: labels.fr,
    labelEn: labels.en,
  };
}

/** Libellé du rang dans la langue demandée (« en » ou, par défaut, français). */
export function getRankLabel(rank: Pick<ChapterRank, 'labelFr' | 'labelEn'>, lang: string): string {
  return lang === 'en' ? rank.labelEn : rank.labelFr;
}

// ── Graines de fin de chapitre (C3) ───────────────────────────────────────────

/** Graines offertes à la fin d'un chapitre (0 si la récompense n'en prévoit pas : chapitre 7). */
export function getChapterSeeds(chapter: Pick<Chapter, 'rewards'>): number {
  let total = 0;
  for (const reward of chapter.rewards) {
    if (reward.type === 'seeds') total += reward.amount;
  }
  return total;
}

/**
 * Chapitres terminés dont la récompense n'a PAS encore été versée, dans l'ordre.
 *   - basé sur la liste des chapitres déjà récompensés (idempotent : rejouer, resynchroniser ou
 *     relancer l'app ne verse jamais deux fois) ;
 *   - rattrape aussi un chapitre terminé sur un autre appareil et jamais récompensé ici.
 */
export function getChaptersToReward(
  levelsCompleted: number,
  rewardedChapterIds: readonly number[] | null | undefined,
): Chapter[] {
  const rewarded = new Set(rewardedChapterIds ?? []);
  return CHAPTERS.filter(c => isChapterCompleted(c.id, { levelsCompleted }) && !rewarded.has(c.id));
}

/** Total de graines à verser pour une liste de chapitres. */
export function sumChapterSeeds(chapters: readonly Pick<Chapter, 'rewards'>[]): number {
  return chapters.reduce((sum, c) => sum + getChapterSeeds(c), 0);
}

/** Fusion de deux listes de chapitres récompensés (union triée, valeurs valides uniquement). */
export function mergeRewardedChapters(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
): number[] {
  const valid = new Set<number>();
  for (const list of [a, b]) {
    for (const id of list ?? []) {
      if (Number.isInteger(id) && id >= 1 && id <= CHAPTERS.length) valid.add(id);
    }
  }
  return Array.from(valid).sort((x, y) => x - y);
}

// ── État d'un chapitre (écran des niveaux, panneau de rang) ─────────────────

export type ChapterStatus = 'completed' | 'current' | 'locked';

export interface ChapterProgress {
  chapterId: number;
  status: ChapterStatus;
  /** Niveaux validés dans ce chapitre (0 à 3). */
  levelsDone: number;
  levelsTotal: number;
  /** Étoiles obtenues dans les niveaux du chapitre. */
  stars: number;
  /** Étoiles possibles dans les niveaux du chapitre (3 niveaux × 30). */
  maxStars: number;
}

export function getChapterProgress(
  chapterId: number,
  challengeStars: Record<string, number> | null | undefined,
  progress?: LevelProgress,
): ChapterProgress {
  const chapter = getChapter(chapterId);
  const p = progress ?? computeLevelProgress(challengeStars);
  if (!chapter) {
    return { chapterId, status: 'locked', levelsDone: 0, levelsTotal: 0, stars: 0, maxStars: 0 };
  }
  const [first, last] = chapter.levels;
  const levelsTotal = last - first + 1;
  const levelsDone = Math.max(0, Math.min(levelsTotal, p.levelsCompleted - (first - 1)));
  let stars = 0;
  for (let level = first; level <= last; level++) stars += p.starsByLevel[level] ?? 0;
  const status: ChapterStatus =
    p.levelsCompleted >= last ? 'completed' : p.levelsCompleted >= first - 1 ? 'current' : 'locked';
  return {
    chapterId,
    status,
    levelsDone,
    levelsTotal,
    stars,
    maxStars: levelsTotal * MAX_STARS_PER_LEVEL,
  };
}