// ============================================================
// SERVICE DÉFI JOURNALIER
// Génération déterministe (seed = date UTC) + Firestore
//
// Deux LIGUES (Progression v2, C5) : Pousse (sans chalet ni tas de bûches) et Grand Chêne (tout).
// Deux grilles par jour : même seed de date, avec un sel par ligue. Même grille, avec le même
// nombre de cases fixées, pour tous les joueurs d'une ligue. Le joueur joue sa ligue la plus haute.
// Plateau : board_15_daily (15 cases, "Clairière Secrète").
// Inclut le champignon (élément exclusif au défi journalier).
//
// Firestore (un classement par ligue et par date) :
//   /dailyChallenges/{YYYY-MM-DD}_{ligue}/results/{userId}
// Les anciens documents `/dailyChallenges/{YYYY-MM-DD}/results/{userId}` (avant les ligues) ne sont
// ni lus ni écrits : voir docs/daily-leagues-firestore.md.
// ============================================================

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { board15cellsDaily } from '../boards/board_15cells_daily';
import { ElementRegistry } from '../elements/ElementRegistry';
import { solve, RngFunction } from '../core/engine/solver';
import { BoardDefinition } from '../core/models/Board';
import { Challenge, FixedPlacement, TokenCount } from '../core/models/Challenge';
import { Composition } from '../constants/difficulty';
import { computeDailyRank, dailyRankField, dateEndMinutes, unpackDailyRank } from '../constants/leaderboardRank';
import {
  DAILY_LEAGUE_ORDER,
  DailyLeague,
  buildDailyChallengeKey,
  buildLeagueDocId,
  getLeagueCompositions,
  getLeagueSeed,
  resolveLeagueFixedCount,
} from '../constants/dailyLeagues';

// ── PRNG déterministe — Mulberry32 ────────────────────────────────────────────
// Retourne une fonction RNG [0, 1) à partir d'un seed entier.
// Période 2^32, distribution uniforme, rapide.

export function mulberry32(seed: number): RngFunction {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Seed depuis une date UTC ──────────────────────────────────────────────────

function dateSeed(date: Date): number {
  const year  = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day   = date.getUTCDate();
  // Hash simple : combine année, mois, jour en un seul entier
  return year * 10000 + month * 100 + day;
}

// ── ID du défi journalier ─────────────────────────────────────────────────────

export function getDailyChallengeId(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `daily_${y}-${m}-${d}`;
}

export function getDailyDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Compositions journalières ─────────────────────────────────────────────────
// Toutes incluent le champignon (1 ou 2) et respectent les invariants I1-I8.
// Σ = 15 (cellCount du board_15_daily)
//
// Invariants rappel :
//   I1: Σ = 15
//   I2: ruche ≤ 1
//   I3: ours ≥ 1 si ruche = 1
//   I4: chien ≥ 2 si chien > 0
//   I5: cerf = biche
//   I6: bucheron ≥ chalet
//   I7: bucheron ≥ 1 si tas_buches > 0
//   I8: champignon ≤ 3 et center_only

const DAILY_COMPOSITIONS: Composition[] = [
  // ── Famille A : bases + champignon ─────────────────────────────────────────
  // A1 : classique variée (3+2+3+2+1+1+1+2=15)
  { bucheron: 3, ours: 2, mouton: 3, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 2 },
  // A2 : plus de bûcherons (4+2+2+2+1+1+1+2=15)
  { bucheron: 4, ours: 2, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 2 },
  // A3 : plus de moutons (2+2+4+2+1+1+1+2=15)
  { bucheron: 2, ours: 2, mouton: 4, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 2 },

  // ── Famille B : avec ruche ─────────────────────────────────────────────────
  // B1 : ruche + chiens (2+2+2+3+1+1+1+1+2=15)
  { bucheron: 2, ours: 2, mouton: 2, chien: 3, loup: 1, cerf: 1, biche: 1, ruche: 1, champignon: 2 },
  // B2 : ruche + équilibre (3+2+2+2+1+1+1+1+2=15)
  { bucheron: 3, ours: 2, mouton: 2, chien: 2, ruche: 1, loup: 1, cerf: 1, biche: 1, champignon: 2 },
  // B3 : ruche + gros moutons (2+2+3+2+1+1+1+1+2=15)
  { bucheron: 2, ours: 2, mouton: 3, chien: 2, ruche: 1, loup: 1, cerf: 1, biche: 1, champignon: 2 },

  // ── Famille C : avec chalet ────────────────────────────────────────────────
  // C1 : chalet simple (3+2+2+2+1+1+1+1+2=15)
  { bucheron: 3, ours: 2, mouton: 2, chien: 2, chalet: 1, loup: 1, cerf: 1, biche: 1, champignon: 2 },
  // C2 : chalet + gros chiens (3+1+2+3+1+1+1+1+2=15)
  { bucheron: 3, ours: 1, mouton: 2, chien: 3, chalet: 1, loup: 1, cerf: 1, biche: 1, champignon: 2 },

  // ── Famille D : avec tas de bûches ─────────────────────────────────────────
  // D1 : tas_buches simple (3+2+2+3+1+1+1+1+1=15)
  { bucheron: 3, ours: 2, mouton: 2, chien: 3, tas_buches: 1, loup: 1, cerf: 1, biche: 1, champignon: 1 },
  // D2 : tas_buches + gros moutons (3+1+3+2+1+1+1+1+2=15)
  { bucheron: 3, ours: 1, mouton: 3, chien: 2, tas_buches: 1, loup: 1, cerf: 1, biche: 1, champignon: 2 },

  // ── Famille E : full-house (chalet + tas_buches) ──────────────────────────
  // E1 : full-house classique (3+2+1+2+1+1+1+1+1+2=15)
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 1, loup: 1, cerf: 1, biche: 1, tas_buches: 1, champignon: 2 },
  // E2 : full-house + ruche (3+2+1+2+1+1+1+1+1+1+1=15)
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 1, loup: 1, cerf: 1, biche: 1, tas_buches: 1, ruche: 1, champignon: 1 },

  // ── Famille F : gros cerfs/biches ──────────────────────────────────────────
  // F1 : double paires cerfs (3+2+1+2+1+2+2+2=15)
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 2, biche: 2, champignon: 2 },
  // F2 : triple paires cerfs (2+2+1+2+1+3+3+1=15)
  { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 3, biche: 3, champignon: 1 },

  // ── Famille G : dominance mouton/loup ────────────────────────────────────
  // G1 : beaucoup de moutons et loups (2+2+3+2+2+1+1+2=15)
  { bucheron: 2, ours: 2, mouton: 3, chien: 2, loup: 2, cerf: 1, biche: 1, champignon: 2 },
  // G2 : mouton/loup max (2+1+4+2+2+1+1+2=15)
  { bucheron: 2, ours: 1, mouton: 4, chien: 2, loup: 2, cerf: 1, biche: 1, champignon: 2 },
];

// ── Utilitaire : mélange Fisher-Yates seeded ──────────────────────────────────

function seededShuffle<T>(arr: T[], rng: RngFunction): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Règles pédagogiques & narratives ─────────────────────────────────────────
// Adaptées de challengeGenerator.ts pour le défi journalier.

/**
 * Vérifie que le défi est pédagogiquement valide.
 *
 * Règles relationnelles (dures) : pour les paires liées par contraintes,
 * au moins un des deux éléments doit être à placer par le joueur.
 * Ça garantit que la relation est visible et jouable.
 */
function isDailyPedagogicallyValid(
  availableTokens: TokenCount[],
  fullTokens: TokenCount[]
): boolean {
  const availableMap = new Map(availableTokens.map(t => [t.elementId, t.count]));
  const fullMap = new Map(fullTokens.map(t => [t.elementId, t.count]));

  const inFull = (id: string) => (fullMap.get(id) ?? 0) > 0;
  const hasAvailable = (id: string) => (availableMap.get(id) ?? 0) > 0;

  // Règle minimale : le joueur doit avoir au moins 1 token à placer.
  if (availableTokens.length === 0 || availableTokens.every(t => t.count === 0)) return false;

  // Règles relationnelles : au moins un des deux éléments d'une paire
  // doit être à poser pour que la relation soit visible et jouable.
  if (inFull('chalet') && !hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  if (inFull('loup') && !hasAvailable('loup') && !hasAvailable('mouton')) return false;
  if (inFull('ruche') && !hasAvailable('ruche') && !hasAvailable('ours')) return false;
  if (inFull('cerf') && !hasAvailable('cerf') && !hasAvailable('biche')) return false;
  if (inFull('biche') && !hasAvailable('biche') && !hasAvailable('cerf')) return false;
  if (inFull('tas_buches') && !hasAvailable('tas_buches') && !hasAvailable('bucheron')) return false;

  // Chien : si présent, au moins 1 chien à poser (meute à construire).
  if (inFull('chien') && !hasAvailable('chien')) return false;

  // Champignon : si présent, au moins 1 champignon à poser
  // (c'est l'élément exclusif du daily, le joueur doit le manipuler).
  if (inFull('champignon') && !hasAvailable('champignon')) return false;

  return true;
}

/**
 * Vérifie que la composition est narrativement cohérente AVANT génération.
 * Si loup est présent, mouton doit l'être aussi (sinon aucune tension).
 * Si chalet est présent, bucheron doit l'être aussi.
 */
function isDailyNarrativelyCoherent(tokenCounts: TokenCount[]): boolean {
  const inCompo = (id: string) => tokenCounts.some(t => t.elementId === id && t.count > 0);
  if (inCompo('loup') && !inCompo('mouton')) return false;
  if (inCompo('chalet') && !inCompo('bucheron')) return false;
  if (inCompo('tas_buches') && !inCompo('bucheron')) return false;
  return true;
}

/**
 * Vérifie la tension narrative APRÈS création des cases fixes.
 * Les paires liées (loup/mouton, chalet/bucheron) ne doivent pas
 * être entièrement fixées — au moins l'un des deux doit être jouable.
 */
function isDailyNarrativelyInteresting(
  availableTokens: TokenCount[],
  fullTokenCounts: TokenCount[]
): boolean {
  const inCompo = (id: string) => fullTokenCounts.some(t => t.elementId === id && t.count > 0);
  const hasAvailable = (id: string) => availableTokens.some(t => t.elementId === id && t.count > 0);

  if (inCompo('loup') && inCompo('mouton')) {
    if (!hasAvailable('loup') && !hasAvailable('mouton')) return false;
  }
  if (inCompo('chalet') && inCompo('bucheron')) {
    if (!hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  }
  if (inCompo('tas_buches') && inCompo('bucheron')) {
    if (!hasAvailable('tas_buches') && !hasAvailable('bucheron')) return false;
  }

  return true;
}

// ── Stratégies de retrait de jetons (seeded) ─────────────────────────────────

/**
 * Retourne l'ordre des indices à essayer de retirer selon la stratégie.
 * 4 stratégies en rotation :
 *   0 → aléatoire pur
 *   1 → bords d'abord (peu de voisins)
 *   2 → centre d'abord (beaucoup de voisins)
 *   3 → alterné (1 bord, 1 centre, ...)
 */
function getDailyRemovalStrategy(
  strategyIndex: number,
  boardDef: BoardDefinition,
  rng: RngFunction
): number[] {
  const allIndices = [...Array(boardDef.cellCount).keys()];

  const byConnectivity = [...allIndices].sort(
    (a, b) => boardDef.connections[a].length - boardDef.connections[b].length
  );
  const edgesFirst = byConnectivity;
  const centerFirst = [...byConnectivity].reverse();

  const alternated: number[] = [];
  for (let i = 0; i < allIndices.length; i++) {
    if (i % 2 === 0) alternated.push(edgesFirst[Math.floor(i / 2)]);
    else alternated.push(centerFirst[Math.floor(i / 2)]);
  }

  // Mélange seeded dans les groupes de même connectivité
  const shuffleWithinGroups = (sorted: number[]): number[] => {
    const result: number[] = [];
    let groupStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      if (i === sorted.length ||
          boardDef.connections[sorted[i]].length !== boardDef.connections[sorted[i - 1]].length) {
        const group = sorted.slice(groupStart, i);
        result.push(...seededShuffle(group, rng));
        groupStart = i;
      }
    }
    return result;
  };

  switch (strategyIndex % 4) {
    case 0: return seededShuffle(allIndices, rng);
    case 1: return shuffleWithinGroups(edgesFirst);
    case 2: return shuffleWithinGroups(centerFirst);
    case 3: return alternated;
    default: return seededShuffle(allIndices, rng);
  }
}

// ── Utilitaire : calcul des jetons disponibles ───────────────────────────────

function computeDailyAvailableTokens(
  solution: string[],
  fixedPlacements: FixedPlacement[],
  fullTokens: TokenCount[]
): TokenCount[] {
  const fixedCounts: Record<string, number> = {};
  for (const fp of fixedPlacements) {
    fixedCounts[fp.elementId] = (fixedCounts[fp.elementId] ?? 0) + 1;
  }
  return fullTokens
    .map(t => ({ elementId: t.elementId, count: t.count - (fixedCounts[t.elementId] ?? 0) }))
    .filter(t => t.count > 0);
}

// ── Génération du défi journalier ─────────────────────────────────────────────

/** Objectif : au moins 9 cases vides → ≤ 6 cases fixes (le plancher de la Pousse est justement 6) */
const TARGET_MAX_FIXED = 6;
/** Tentatives par composition avant de passer à la suivante */
const ATTEMPTS_PER_COMPOSITION = 5;

export interface DailyChallenge extends Challenge {
  /** Nombre de cases pré-remplies de base (= noyau dur, cas le plus dur) */
  baseFixedCount: number;
  /**
   * Ordre déterministe des indices de cases pour les placements fixes.
   * Les `baseFixedCount` premières cases sont le noyau dur (unicité garantie).
   * getDailyFixedPlacements prend les N premières pour la ligue (identique pour tous ses joueurs).
   */
  fixedOrder: number[];
}

/**
 * Génère le défi journalier pour une date donnée.
 * La date sert de seed → même résultat pour tous les joueurs.
 *
 * Stratégie (adaptée du générateur classique) :
 *   1. Essayer les compositions en rotation (les moins utilisées d'abord)
 *   2. Pour chaque composition : trouver une solution complète
 *   3. Retirer itérativement des jetons (stratégie de retrait variée)
 *      en vérifiant l'unicité à chaque retrait
 *   4. Vérifier les règles pédagogiques + narratives
 *   5. Si ≥ 9 cases vides atteintes → succès
 *   6. Si la composition bloque → passer à la suivante
 *
 * Retourne null si aucune composition ne produit un défi valide (très improbable).
 */
export function generateDailyChallenge(
  date: Date,
  league: DailyLeague = 'grand_chene',
): DailyChallenge | null {
  // Seed de la date + sel de la ligue : deux grilles différentes le même jour, identiques pour tous
  // les joueurs d'une même ligue. La Pousse garde le seed d'origine (sel nul).
  const seed = getLeagueSeed(dateSeed(date), league);
  const rng  = mulberry32(seed);

  const boardDef    = board15cellsDaily;
  const elementDefs = ElementRegistry;
  const challengeId = getDailyChallengeId(date) + '_' + league;

  // Compositions de la ligue (Pousse : sans chalet ni tas de bûches), dans un ordre déterministe mais
  // varié (rotation par jour via le seed). `compIndex` reste l'indice dans la liste COMPLÈTE : il sert
  // aux seeds de tentative, donc les grilles du Grand Chêne ne changent pas d'une version à l'autre.
  const allowed = new Set(getLeagueCompositions(DAILY_COMPOSITIONS, league));
  const compositionOrder = seededShuffle(
    DAILY_COMPOSITIONS.map((_, i) => i).filter(i => allowed.has(DAILY_COMPOSITIONS[i])),
    rng
  );

  // Compteur de debug
  let dbgNoSolution = 0;
  let dbgNotCoherent = 0;
  let dbgNotEnoughEmpty = 0;
  let dbgNotPedago = 0;
  let dbgNotNarrative = 0;

  for (const compIndex of compositionOrder) {
    const composition = DAILY_COMPOSITIONS[compIndex];

    // Construire l'inventaire complet depuis la composition
    const fullTokens: TokenCount[] = [];
    for (const [elementId, count] of Object.entries(composition)) {
      if ((count as number) > 0) {
        fullTokens.push({ elementId, count: count as number });
      }
    }

    // Vérifier I1 : Σ = cellCount
    const totalTokens = fullTokens.reduce((acc, t) => acc + t.count, 0);
    if (totalTokens !== boardDef.cellCount) {
      console.error(`[DailyChallenge] I1 violé compo #${compIndex}: Σ=${totalTokens} ≠ ${boardDef.cellCount}`);
      continue;
    }

    // Vérifier cohérence narrative AVANT génération
    if (!isDailyNarrativelyCoherent(fullTokens)) {
      dbgNotCoherent++;
      continue;
    }

    // Essayer plusieurs tentatives avec cette composition
    for (let attempt = 0; attempt < ATTEMPTS_PER_COMPOSITION; attempt++) {
      const attemptSeed = seed + compIndex * 7919 + attempt * 13;
      const attemptRng = mulberry32(attemptSeed);

      // 1. Trouver une solution complète
      const solverResult = solve({
        boardDef,
        fixedPlacements: [],
        availableTokens: fullTokens,
        elementDefs,
        rng: attemptRng,
      });

      if (solverResult.solutionCount === 0) {
        dbgNoSolution++;
        continue;
      }

      const solution = solverResult.solutions[0];

      // 2. Retrait itératif (comme le générateur classique)
      //    Partir de la solution complète fixée, retirer un par un en vérifiant l'unicité
      const strategyRng = mulberry32(attemptSeed + 31);
      const removalOrder = getDailyRemovalStrategy(attempt, boardDef, strategyRng);

      let fixedPlacements: FixedPlacement[] = solution.map((elementId, cellIndex) => ({
        cellIndex,
        elementId,
      }));

      let emptyCellCount = 0;
      // Ordre dans lequel les cases ont été retirées (pour fixedOrder)
      const removedOrder: number[] = [];

      for (const idx of removalOrder) {
        // Retirer temporairement ce jeton
        const newFixed = fixedPlacements.filter(fp => fp.cellIndex !== idx);
        const available = computeDailyAvailableTokens(solution, newFixed, fullTokens);

        const checkRng = mulberry32(attemptSeed + idx * 37);
        const checkResult = solve({
          boardDef,
          fixedPlacements: newFixed,
          availableTokens: available,
          elementDefs,
          rng: checkRng,
        });

        if (checkResult.isUnique) {
          fixedPlacements = newFixed;
          emptyCellCount++;
          removedOrder.push(idx);
        }
        // Sinon, ce jeton est nécessaire à l'unicité → on le garde fixe
      }

      // 3. Vérifier qu'on a atteint le seuil de cases vides
      const actualFixedCount = boardDef.cellCount - emptyCellCount;
      if (actualFixedCount > TARGET_MAX_FIXED) {
        dbgNotEnoughEmpty++;
        continue; // Trop de cases fixes, essayer une autre tentative/composition
      }

      // 4. Calculer les jetons disponibles finaux
      const availableTokens = computeDailyAvailableTokens(solution, fixedPlacements, fullTokens);

      // 5. Vérifications pédagogiques
      if (!isDailyPedagogicallyValid(availableTokens, fullTokens)) {
        dbgNotPedago++;
        continue;
      }

      // 6. Vérification narrative
      if (!isDailyNarrativelyInteresting(availableTokens, fullTokens)) {
        dbgNotNarrative++;
        continue;
      }

      // Construire fixedOrder : les cases qui restent fixes (noyau dur),
      // suivies des cases retirées dans l'ordre inverse (pour getDailyFixedPlacements).
      // Quand on ajoute des cases pour un joueur plus faible, on re-fixe les
      // dernières cases retirées en premier (les moins "utiles" à l'unicité).
      const fixedIndices = fixedPlacements.map(fp => fp.cellIndex);
      const removedReversed = [...removedOrder].reverse();
      const fixedOrder = [...fixedIndices, ...removedReversed];

      console.log(
        `[DailyChallenge] Succès compo #${compIndex} tentative #${attempt}: ` +
        `${actualFixedCount} fixes, ${emptyCellCount} vides`
      );

      return {
        id: challengeId,
        boardId: 'board_15_daily',
        level: 'niveau_15' as any,
        levelNumber: 0,
        challengeNumber: 0,
        fixedPlacements,
        availableTokens,
        solution,
        solutionCount: 1,
        estimatedDuration: 180,
        createdAt: date.toISOString(),
        baseFixedCount: actualFixedCount,
        fixedOrder,
      };
    }
  }

  console.error(
    `[DailyChallenge] Échec après toutes les compositions — ` +
    `noSol:${dbgNoSolution} notCoherent:${dbgNotCoherent} ` +
    `notEnoughEmpty:${dbgNotEnoughEmpty} notPedago:${dbgNotPedago} ` +
    `notNarrative:${dbgNotNarrative}`
  );
  return null;
}

// ── Cases pré-remplies de la ligue ────────────────────────────────────────────

/**
 * Retourne les placements fixes de la grille pour une LIGUE.
 *
 * Le nombre de cases fixées est le même pour TOUS les joueurs de la ligue (C5) : il ne dépend plus du
 * niveau du joueur, seulement de la ligue (`DAILY_LEAGUE_FIXED_COUNT`) et de la grille du jour.
 *   - Le défi est généré avec `baseFixedCount` cases fixes (le minimum nécessaire à l'unicité).
 *   - `fixedOrder` contient l'ordre déterministe de toutes les cases.
 *   - On prend les N premières de `fixedOrder`, avec N >= baseFixedCount (`resolveLeagueFixedCount`) :
 *     ajouter des cases fixes ne fait que réduire l'espace de recherche, l'unicité est donc préservée.
 */
export function getDailyFixedPlacements(
  league: DailyLeague,
  dailyChallenge: DailyChallenge,
): { fixedPlacements: FixedPlacement[]; availableTokens: TokenCount[] } {
  const targetFixed = resolveLeagueFixedCount(league, dailyChallenge.baseFixedCount);

  const { solution, fixedOrder } = dailyChallenge;

  // Prendre les targetFixed premières cases de fixedOrder
  const fixedPlacements: FixedPlacement[] = fixedOrder
    .slice(0, targetFixed)
    .map(cellIndex => ({ cellIndex, elementId: solution[cellIndex] }));

  // Calculer les jetons disponibles (= total - fixes)
  const fixedCounts: Record<string, number> = {};
  for (const fp of fixedPlacements) {
    fixedCounts[fp.elementId] = (fixedCounts[fp.elementId] ?? 0) + 1;
  }

  // Tous les éléments de la solution
  const fullCounts: Record<string, number> = {};
  for (const el of solution) {
    fullCounts[el] = (fullCounts[el] ?? 0) + 1;
  }

  const availableTokens: TokenCount[] = Object.entries(fullCounts)
    .map(([elementId, count]) => ({
      elementId,
      count: count - (fixedCounts[elementId] ?? 0),
    }))
    .filter(t => t.count > 0);

  return { fixedPlacements, availableTokens };
}

/** Clé de chrono local du défi d'une ligue : `daily_2026-11-06_pousse`. */
export { buildDailyChallengeKey };
// ── Firestore — Résultats journaliers, PAR LIGUE ─────────────────────────────
//
// Schéma : /dailyChallenges/{YYYY-MM-DD}_{ligue}/results/{userId}
//   - un classement par ligue ET par date ; un joueur ne joue qu'UNE ligue par jour (sa plus haute) ;
//   - le chemin garde 4 segments, comme avant les ligues : `collectionGroup('results')` reste valable ;
//   - les anciens documents `/dailyChallenges/{date}/…` (sans ligue) ne sont plus lus ni écrits.

export interface DailyResult {
  userId: string;
  username: string;
  timeMs: number;
  playerLevel: number;
  /** Ligue jouée. Absent des anciens résultats (avant la Progression v2). */
  league?: DailyLeague;
  completedAt: any; // Firestore Timestamp
}

const DAILY_COLLECTION = 'dailyChallenges';

/**
 * Soumet le résultat du défi journalier d'un joueur dans le classement de SA ligue.
 * Écrit une seule fois par joueur, par jour et par ligue (write-once).
 */
export async function submitDailyResult(
  date: string,
  league: DailyLeague,
  userId: string,
  username: string,
  timeMs: number,
  playerLevel: number
): Promise<void> {
  try {
    const resultRef = doc(db, DAILY_COLLECTION, buildLeagueDocId(date, league), 'results', userId);
    await setDoc(resultRef, {
      userId,
      username,
      timeMs,
      playerLevel,
      league,
      completedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[DailyChallenge] Erreur soumission résultat:', error);
    throw error;
  }
}

/**
 * Vérifie si le joueur a déjà joué le défi journalier de cette ligue aujourd'hui.
 */
export async function getDailyStatus(
  date: string,
  league: DailyLeague,
  userId: string
): Promise<DailyResult | null> {
  try {
    const resultRef = doc(db, DAILY_COLLECTION, buildLeagueDocId(date, league), 'results', userId);
    const snap = await getDoc(resultRef);
    if (!snap.exists()) return null;
    return snap.data() as DailyResult;
  } catch {
    return null;
  }
}

/**
 * Écoute le classement journalier d'UNE ligue en temps réel.
 * Trié par timeMs ascendant (plus rapide = meilleur). Les autres ligues n'y figurent jamais.
 */
export function subscribeDailyLeaderboard(
  date: string,
  league: DailyLeague,
  maxCount: number,
  onChange: (results: DailyResult[]) => void
): Unsubscribe {
  const resultsRef = collection(db, DAILY_COLLECTION, buildLeagueDocId(date, league), 'results');
  const q = query(resultsRef, orderBy('timeMs', 'asc'), limit(maxCount));

  return onSnapshot(q, snapshot => {
    const results: DailyResult[] = [];
    snapshot.forEach(docSnap => {
      results.push(docSnap.data() as DailyResult);
    });
    onChange(results);
  }, error => {
    console.error('[DailyChallenge] Erreur écoute classement:', error);
    onChange([]);
  });
}
// ── Calcul des récompenses journalières ───────────────────────────────────────

export interface DailyReward {
  baseSeeds: number;
  topPercentBonus: number;
  top3Bonus: number;
  firstPlaceBonus: number;
  streakBonus: number;
  total: number;
}

/**
 * Calcule les graines gagnées pour le défi journalier.
 */
export function calculateDailyReward(
  rank: number,
  totalParticipants: number,
  dailyStreak: number
): DailyReward {
  const baseSeeds = 5;

  // Top 10%
  const topPercentBonus = totalParticipants > 0 && rank <= Math.ceil(totalParticipants * 0.1)
    ? 5
    : 0;

  // Top 3
  const top3Bonus = rank <= 3 ? 15 : 0;

  // #1 mondial
  const firstPlaceBonus = rank === 1 ? 25 : 0;

  // Streak 7 jours (bonus unique au passage du palier)
  const streakBonus = dailyStreak === 7 ? 20 : 0;

  const total = baseSeeds + topPercentBonus + top3Bonus + firstPlaceBonus + streakBonus;

  return { baseSeeds, topPercentBonus, top3Bonus, firstPlaceBonus, streakBonus, total };
}

// ── Scellement du record du jour précédent, PAR LIGUE (Lot C) ─────────────────
//
// Appelé au démarrage de l'app quand on détecte un nouveau jour. Pour la date `previousDate` ET chaque ligue :
//   1. Lit le top 1 des résultats de cette ligue (timeMs asc).
//   2. DANS UNE TRANSACTION : relit le document `dailyChallenges/{date}_{ligue}` ; s'il est déjà scellé, ne fait rien ;
//      sinon crédite le gagnant ET marque la ligue `sealed = true`. Les deux écritures sont atomiques : une victoire
//      n'est jamais créditée deux fois (deux appareils qui scellent en même temps) ni perdue (échec entre les deux).
//   3. Le crédit va dans le classement DE LA LIGUE du gagnant (`leaderboard/{uid}.dailyRankPousse` ou
//      `dailyRankGrandChene`), jamais mélangé avec l'autre ligue. Le départage est « le premier arrivé » à ce nombre
//      de victoires : l'instant de crédit est la fin de la journée scellée (déterministe, identique quel que soit
//      l'appareil qui scelle).
//   4. Le document `leaderboard/{uid}` est créé s'il n'existe pas (`setDoc merge`) : avant ce lot, `updateDoc` échouait
//      et la victoire du jour n'était jamais créditée tant que le gagnant n'avait pas gagné une partie Solo.
//
// Chaque ligue a SON record : un joueur de la Pousse et un joueur du Grand Chêne peuvent donc chacun gagner une
// victoire du jour. Idempotent grâce à `sealed`.

export async function sealDailyRecord(previousDate: string): Promise<void> {
  for (const league of DAILY_LEAGUE_ORDER) {
    await sealLeagueRecord(previousDate, league);
  }
}

async function sealLeagueRecord(previousDate: string, league: DailyLeague): Promise<void> {
  try {
    const docId = buildLeagueDocId(previousDate, league);
    const dailyDocRef = doc(db, DAILY_COLLECTION, docId);

    // Lecture rapide hors transaction : déjà scellé → rien à faire (cas le plus fréquent, une lecture par ligue)
    const pre = await getDoc(dailyDocRef);
    if (pre.exists() && pre.data()?.sealed === true) return;

    // Top 1 des résultats de ce jour, dans cette ligue
    const resultsRef = collection(db, DAILY_COLLECTION, docId, 'results');
    const snap = await getDocs(query(resultsRef, orderBy('timeMs', 'asc'), limit(1)));
    const winner = snap.empty ? null : (snap.docs[0].data() as DailyResult);

    await runTransaction(db, async tx => {
      const dailySnap = await tx.get(dailyDocRef);
      if (dailySnap.exists() && dailySnap.data()?.sealed === true) return; // scellé entre-temps par un autre appareil

      if (!winner) {
        // Personne n'a joué cette ligue ce jour : on scelle quand même pour ne pas retraiter
        tx.set(dailyDocRef, { sealed: true, sealedAt: serverTimestamp(), league }, { merge: true });
        return;
      }

      const lbRef = doc(db, 'leaderboard', winner.userId);
      const lbSnap = await tx.get(lbRef);
      const field = dailyRankField(league);
      const previousRank = lbSnap.exists() && typeof lbSnap.data()?.[field] === 'number' ? (lbSnap.data()![field] as number) : 0;
      const wins = unpackDailyRank(previousRank).wins + 1;

      tx.set(lbRef, {
        userId: winner.userId,
        username: winner.username,
        [field]: computeDailyRank(wins, dateEndMinutes(previousDate)),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      tx.set(dailyDocRef, {
        sealed: true,
        sealedAt: serverTimestamp(),
        league,
        recordHolder: { userId: winner.userId, username: winner.username, timeMs: winner.timeMs },
      }, { merge: true });
    });
  } catch (e) {
    // Silencieux : erreur réseau. Le scellement est retenté au prochain démarrage (idempotent).
    console.warn(`[sealDailyRecord] erreur (${league}):`, e);
  }
}