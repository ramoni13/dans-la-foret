// ============================================================
// CÉRÉMONIES — logique pure (Progression v2, C7 / Lot 4)
//
// Une cérémonie de chapitre met en scène la fin d'un chapitre : emblème qui se remplit d'étoiles,
// nouveau rang, graines, cartes-récompenses à retourner, aperçu du chapitre suivant, puis
// « Essayer maintenant » / « Plus tard ».
//
// Ce fichier est PUR (aucune dépendance React / Zustand / Firebase) : testé par
// __tests__/ceremonies.test.ts. Il décide :
//   - de l'identifiant d'une cérémonie (`chapter_N`) et de la file des cérémonies à jouer ;
//   - des cartes-récompenses (typées : mode, carte arbre, musique, région, trophée, graines) ;
//   - des étapes du déroulé et des silhouettes du chapitre suivant ;
//   - des pastilles « Nouveau » sur les tuiles des modes débloqués.
// ============================================================

import {
  CHAPTERS,
  Chapter,
  ChapterReward,
  HerbierRegion,
  ChapterRank,
  ProgressionFeature,
  getChapter,
  getChapterSeeds,
  getRankForLevel,
  isChapterCompleted,
} from './progression';
import { LEVEL_META } from '../data/levelMeta';

// ── Identifiants ──────────────────────────────────────────────────────────────

const CEREMONY_ID = /^chapter_([1-7])$/;

/** Identifiant de la cérémonie du chapitre `chapterId` (1 à 7). */
export function buildChapterCeremonyId(chapterId: number): string {
  return `chapter_${chapterId}`;
}

/** Numéro de chapitre d'un identifiant de cérémonie, ou null si l'identifiant est invalide. */
export function parseChapterCeremonyId(id: string): number | null {
  const m = CEREMONY_ID.exec(id);
  return m ? parseInt(m[1], 10) : null;
}

// ── File des cérémonies (persistée dans playerStore) ─────────────────────────

/**
 * Cérémonies à AJOUTER à la file : chapitres terminés dont la cérémonie n'est ni déjà en attente,
 * ni déjà vue. Ordre croissant. Idempotent : on peut l'appeler à chaque victoire et à chaque
 * connexion sans jamais mettre deux fois la même cérémonie.
 */
export function getCeremoniesToEnqueue(
  levelsCompleted: number,
  pending: readonly string[] | null | undefined,
  seen: readonly string[] | null | undefined,
): string[] {
  const known = new Set<string>([...(pending ?? []), ...(seen ?? [])]);
  return CHAPTERS
    .filter(c => isChapterCompleted(c.id, { levelsCompleted }))
    .map(c => buildChapterCeremonyId(c.id))
    .filter(id => !known.has(id));
}

/** Prochaine cérémonie à jouer : la plus ancienne en attente et valide, ou null. */
export function getNextCeremony(pending: readonly string[] | null | undefined): string | null {
  for (const id of pending ?? []) {
    if (parseChapterCeremonyId(id) !== null) return id;
  }
  return null;
}

/** Fusion de deux listes d'identifiants de cérémonies (union, ordre chronologique des chapitres, valides seulement). */
export function mergeCeremonyIds(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): string[] {
  const chapters = new Set<number>();
  for (const list of [a, b]) {
    for (const id of list ?? []) {
      const n = parseChapterCeremonyId(id);
      if (n !== null) chapters.add(n);
    }
  }
  return Array.from(chapters).sort((x, y) => x - y).map(buildChapterCeremonyId);
}

// ── Cartes-récompenses (face cachée, retournées d'un tap) ─────────────────────

/**
 * Carte à retourner. Typée : chaque type de récompense est présenté, et toutes sont attribuées.
 *   - `tree_card` : carte d'Herbier (Lot 7, `grantChapterCards`) ;
 *   - `music` : titre de musique du chapitre (Lot 8, `musicUnlocks.ts`) ;
 *   - `trophy` : trophée final « Esprit accompli », décerné par `trophyService` à la fin du chapitre 7 ;
 *   - `mode` mène à « Essayer maintenant ».
 */
export type CeremonyCard =
  | { kind: 'mode'; feature: ProgressionFeature; titleKey: string; emoji: string }
  | { kind: 'tree_card'; legendary: boolean; titleKey: string; emoji: string }
  | { kind: 'music'; chapter: number; titleKey: string; emoji: string }
  | { kind: 'region'; region: HerbierRegion; titleKey: string; emoji: string }
  | { kind: 'trophy'; id: string; titleKey: string; emoji: string };

const FEATURE_CARD: Record<ProgressionFeature, { titleKey: string; emoji: string }> = {
  duel:                 { titleKey: 'ceremony_feature_duel',                emoji: '🤝' },
  onf_sentier:          { titleKey: 'ceremony_feature_onf_sentier',         emoji: '🗺️' },
  onf_clairiere:        { titleKey: 'ceremony_feature_onf_clairiere',       emoji: '🌿' },
  onf_profonde:         { titleKey: 'ceremony_feature_onf_profonde',        emoji: '🌲' },
  daily_pousse:         { titleKey: 'ceremony_feature_daily_pousse',        emoji: '🌅' },
  daily_grand_chene:    { titleKey: 'ceremony_feature_daily_grand_chene',   emoji: '🌳' },
  herbier_europe:       { titleKey: 'ceremony_feature_herbier_europe',      emoji: '🇪🇺' },
  herbier_monde:        { titleKey: 'ceremony_feature_herbier_monde',       emoji: '🌍' },
  herbier_remarquables: { titleKey: 'ceremony_feature_herbier_remarquables', emoji: '🏛️' },
};

const REGION_CARD: Record<HerbierRegion, { titleKey: string; emoji: string }> = {
  france:        { titleKey: 'ceremony_region_france',        emoji: '🇫🇷' },
  europe:        { titleKey: 'ceremony_region_europe',        emoji: '🇪🇺' },
  monde:         { titleKey: 'ceremony_region_monde',         emoji: '🌍' },
  remarquables:  { titleKey: 'ceremony_region_remarquables',  emoji: '🏛️' },
};

function toCard(reward: ChapterReward): CeremonyCard | null {
  switch (reward.type) {
    case 'feature':
      // Les régions de l'Herbier sont présentées par la carte « région » (herbier_region),
      // pas en double par la fonctionnalité : on ne garde ici que les modes de jeu.
      if (reward.feature.startsWith('herbier_')) return null;
      return { kind: 'mode', feature: reward.feature, ...FEATURE_CARD[reward.feature] };
    case 'tree_card':
      return {
        kind: 'tree_card',
        legendary: !!reward.legendary,
        titleKey: reward.legendary ? 'ceremony_card_tree_legendary' : 'ceremony_card_tree',
        emoji: reward.legendary ? '🌟' : '🍃',
      };
    case 'music':
      return { kind: 'music', chapter: reward.chapter, titleKey: 'ceremony_card_music', emoji: '🎵' };
    case 'herbier_region':
      return { kind: 'region', region: reward.region, ...REGION_CARD[reward.region] };
    case 'trophy':
      return { kind: 'trophy', id: reward.id, titleKey: 'ceremony_card_trophy', emoji: '🏆' };
    case 'seeds':
      // Les graines ont leur propre étape (« les graines volent ») : pas de carte à retourner.
      return null;
  }
}

/** Cartes à retourner pour un chapitre, dans l'ordre des récompenses de `CHAPTERS`. */
export function getCeremonyCards(chapter: Pick<Chapter, 'rewards'>): CeremonyCard[] {
  const cards: CeremonyCard[] = [];
  for (const reward of chapter.rewards) {
    const card = toCard(reward);
    if (card) cards.push(card);
  }
  return cards;
}

/** Modes de jeu débloqués par un chapitre (pour « Essayer maintenant » et les pastilles). */
export function getChapterModes(chapter: Pick<Chapter, 'rewards'>): ProgressionFeature[] {
  const modes: ProgressionFeature[] = [];
  for (const reward of chapter.rewards) {
    if (reward.type === 'feature' && !reward.feature.startsWith('herbier_')) modes.push(reward.feature);
  }
  return modes;
}

// ── « Essayer maintenant » ────────────────────────────────────────────────────

export type CeremonyDestination =
  | '/game/onf-lobby'
  | '/game/daily'
  | '/(tabs)/challenge'
  | '/(tabs)/';

/**
 * Où mène « Essayer maintenant » : le premier mode de jeu débloqué par le chapitre, sinon l'accueil.
 * Un mode de jeu = Duel, Forestier ou Journalier (pas l'Herbier : il s'ouvre depuis l'accueil, pas depuis « Essayer maintenant »).
 */
export function getTryNowDestination(chapter: Pick<Chapter, 'rewards'>): CeremonyDestination {
  const first = getChapterModes(chapter)[0];
  switch (first) {
    case 'duel':               return '/(tabs)/challenge';
    case 'onf_sentier':
    case 'onf_clairiere':
    case 'onf_profonde':       return '/game/onf-lobby';
    case 'daily_pousse':
    case 'daily_grand_chene':  return '/game/daily';
    default:                   return '/(tabs)/';
  }
}

/** Le chapitre débloque-t-il au moins un mode vers lequel mener le joueur ? */
export function hasTryNow(chapter: Pick<Chapter, 'rewards'>): boolean {
  return getTryNowDestination(chapter) !== '/(tabs)/';
}

// ── Aperçu du chapitre suivant (étape 4) ─────────────────────────────────────

export interface NextChapterPreview {
  chapterId: number;
  /** Éléments NOUVEAUX introduits par le chapitre suivant, dans l'ordre (silhouettes). */
  newElementIds: string[];
}

/**
 * Éléments inédits du chapitre suivant : ceux que le joueur découvrira dans ses niveaux et qu'il
 * n'a jamais vus (introduits à un niveau du chapitre suivant). null après le dernier chapitre.
 */
export function getNextChapterPreview(chapterId: number): NextChapterPreview | null {
  const next = getChapter(chapterId + 1);
  if (!next) return null;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (let level = next.levels[0]; level <= next.levels[1]; level++) {
    for (const id of LEVEL_META[level]?.newElements ?? []) {
      if (!seen.has(id)) { seen.add(id); ids.push(id); }
    }
  }
  return { chapterId: next.id, newElementIds: ids };
}

// ── Déroulé de la cérémonie (5 étapes, avancées au tap) ──────────────────────

export type CeremonyStepId = 'emblem' | 'rank' | 'cards' | 'preview' | 'actions';

export interface CeremonyStep {
  id: CeremonyStepId;
  /** Durée MAXIMALE (ms) pendant laquelle l'étape reste imposée avant de pouvoir être passée. */
  forcedMs: number;
}

/** Aucune étape n'impose plus de 2 s (C7). */
export const CEREMONY_MAX_FORCED_MS = 2000;

/**
 * Étapes d'une cérémonie. L'aperçu du chapitre suivant disparaît après le dernier chapitre ;
 * les cartes disparaissent si le chapitre n'en offre aucune.
 */
export function getCeremonySteps(chapterId: number): CeremonyStep[] {
  const chapter = getChapter(chapterId);
  const steps: CeremonyStep[] = [
    { id: 'emblem', forcedMs: 1500 },
    { id: 'rank',   forcedMs: 1200 },
  ];
  if (chapter && getCeremonyCards(chapter).length > 0) steps.push({ id: 'cards', forcedMs: 0 });
  if (getNextChapterPreview(chapterId)) steps.push({ id: 'preview', forcedMs: 800 });
  steps.push({ id: 'actions', forcedMs: 0 });
  return steps;
}

/**
 * Rang annoncé à la fin du chapitre `chapterId` : celui du chapitre SUIVANT (le rang affiché est
 * celui du chapitre en cours, donc terminer un chapitre fait entrer dans le suivant). Après le
 * dernier chapitre il n'y a pas de suivant : le rang reste « Esprit de la Forêt ».
 */
export function getCeremonyRank(chapterId: number): ChapterRank | null {
  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  const next = getChapter(chapterId + 1);
  return getRankForLevel((next ?? chapter).levels[0]);
}

/** Nombre d'étoiles de l'emblème : 1 par niveau du chapitre. */
export function getEmblemStarCount(chapter: Pick<Chapter, 'levels'>): number {
  return chapter.levels[1] - chapter.levels[0] + 1;
}

/** Résumé de ce que la cérémonie d'un chapitre affiche (graines, cartes, modes, aperçu). */
export interface CeremonySummary {
  chapterId: number;
  seeds: number;
  cards: CeremonyCard[];
  modes: ProgressionFeature[];
  preview: NextChapterPreview | null;
  tryNow: CeremonyDestination;
  steps: CeremonyStep[];
}

export function buildCeremonySummary(chapterId: number): CeremonySummary | null {
  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  return {
    chapterId,
    seeds: getChapterSeeds(chapter),
    cards: getCeremonyCards(chapter),
    modes: getChapterModes(chapter),
    preview: getNextChapterPreview(chapterId),
    tryNow: getTryNowDestination(chapter),
    steps: getCeremonySteps(chapterId),
  };
}

// ── Pastilles « Nouveau » (modes débloqués, jusqu'à la première partie) ───────

/** Modes de jeu qui portent une pastille « Nouveau » (pas l'Herbier). */
export type NewBadgeFeature =
  | 'duel' | 'onf_sentier' | 'onf_clairiere' | 'onf_profonde' | 'daily_pousse' | 'daily_grand_chene';

const NEW_BADGE_FEATURES: readonly string[] = [
  'duel', 'onf_sentier', 'onf_clairiere', 'onf_profonde', 'daily_pousse', 'daily_grand_chene',
];

export function isNewBadgeFeature(feature: string): feature is NewBadgeFeature {
  return NEW_BADGE_FEATURES.includes(feature);
}

/**
 * Pastilles à AJOUTER quand des cérémonies viennent d'être mises en file : les modes de jeu que
 * débloquent ces chapitres, sans doublon avec les pastilles déjà présentes.
 *
 * Les pastilles sont volontairement liées à la MISE EN FILE de la cérémonie (déjà dédoublonnée par
 * `pendingCeremonies` + `seenCeremonies`) et non recalculées depuis la progression : sinon une pastille
 * effacée à la première partie reviendrait à la vérification suivante, le chapitre restant terminé.
 */
export function getNewBadgesForCeremonies(
  ceremonyIds: readonly string[],
  current: readonly string[] | null | undefined,
): string[] {
  const known = new Set<string>(current ?? []);
  const out: string[] = [];
  for (const id of ceremonyIds) {
    const n = parseChapterCeremonyId(id);
    const chapter = n === null ? null : getChapter(n);
    if (!chapter) continue;
    for (const mode of getChapterModes(chapter)) {
      if (isNewBadgeFeature(mode) && !known.has(mode) && !out.includes(mode)) out.push(mode);
    }
  }
  return out;
}

/**
 * Pastille « Nouveau » de la tuile `feature` : visible tant que le joueur n'a pas fait sa première
 * partie dans ce mode. Le Journalier et le Forestier regroupent leurs paliers sur UNE tuile.
 */
export function hasNewBadge(
  tile: 'duel' | 'onf' | 'daily',
  newFeatureBadges: readonly string[] | null | undefined,
): boolean {
  const list = newFeatureBadges ?? [];
  switch (tile) {
    case 'duel':  return list.includes('duel');
    case 'onf':   return list.some(f => f.startsWith('onf_'));
    case 'daily': return list.some(f => f.startsWith('daily_'));
  }
}

/** Retire de la liste les pastilles de la tuile `tile` (1re partie jouée). */
export function clearNewBadges(
  tile: 'duel' | 'onf' | 'daily',
  newFeatureBadges: readonly string[] | null | undefined,
): string[] {
  const prefix = tile === 'duel' ? null : tile === 'onf' ? 'onf_' : 'daily_';
  return (newFeatureBadges ?? []).filter(f => (prefix === null ? f !== 'duel' : !f.startsWith(prefix)));
}
