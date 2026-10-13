// ============================================================
// SERVICE MODE ONF — Grille Forestière 4×4 (Sudoku Forestier)
// Génération temps réel avec contrainte row_col_unique.
//
// Mode unique : 4×4 (16 cases). Le 3×3 est abandonné car les
// compositions asymétriques y sont structurellement impossibles :
// avec max-1-par-ligne sur une grille 3 lignes, un élément ne peut
// pas dépasser count=3 — or les compositions pédagogiques en ont
// besoin (ex. {loup:4, mouton:5}).
//
// Invariants de composition :
//   I1  : Σ éléments = 16 (cellCount 4×4)
//   I2  : ruche ≤ 1
//   I3  : ours ≥ 1 si ruche = 1
//   I4  : chien exclu (connected_group + sudoku = impossible)
//   I5  : cerf = biche (paires)
//   I6  : bucheron ≥ chalet si les deux présents
//   I7  : bucheron ≥ 1 si tas_buches > 0
//   I8  : champignon ≤ 2 (center_only — max 4 cases centrales disponibles)
//   I9  : count(element) ≤ gridSize (4) pour chaque élément
//         → garantit qu'au moins une disposition ligne/col est possible
//   I10 : au moins 2 éléments distincts
//   I11 : si ruche = 1 → ours ≤ 2 (contrainte voisinage + sudoku très sévère)
//   I12 : champignon ≤ nb de specialCells.center (4 en 4×4)
//
// Progression de difficulté (cases fixes pré-remplies) :
//   1–4  résolues → 6 fixes (débutant  : 10 cases à placer)
//   5–19 résolues → 4 fixes (régulier  : 12 cases à placer)
//   20+  résolues → 3 fixes (confirmé  : 13 cases à placer)
// ============================================================

import { board4x4Onf } from '../boards/board_4x4_onf';
import { ElementRegistry } from '../elements/ElementRegistry';
import { solveOnf, RngFunction } from '../core/engine/solver';
import { Challenge, FixedPlacement, TokenCount } from '../core/models/Challenge';
import { Composition } from '../constants/difficulty';

// ── PRNG ─────────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], rng: RngFunction): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Compositions ONF 4×4 ─────────────────────────────────────────────────────
// 16 cases, Σ = 16.
// Règle sudoku assouplie : max 1 exemplaire identique par ligne ET par colonne.
// Sur 4 lignes/colonnes, un élément peut apparaître 1 à 4 fois.
// Compositions asymétriques avec tensions pédagogiques prioritaires.
//
// Contraintes des éléments utilisés :
//   bucheron : ≠ voisin bucheron
//   ours     : ≠ voisin ours ; doit voisiner ruche si ruche présente
//   mouton   : ≠ voisin mouton ; ≠ voisin loup
//   loup     : ≠ voisin loup  ; ≠ voisin mouton
//   cerf     : ≠ voisin cerf  ; paired_specific avec biche (1-pour-1)
//   biche    : ≠ voisin biche ; paired_specific avec cerf  (1-pour-1)
//   ruche    : max 1 par board ; doit voisiner ours

const ONF_COMPOSITIONS_4X4: Composition[] = [
  // ── Famille A — Diversité 6 types (sans éléments spéciaux) ────────────────
  // Σ = 16, aucun élément > 4, cerf = biche, ≥ 4 types distincts
  // Note : "loup" est défini dans src/elements/loup.ts
  { bucheron: 4, mouton: 4, ours: 3, loup: 3, cerf: 1, biche: 1 },   // A01
  { bucheron: 4, mouton: 3, ours: 4, loup: 3, cerf: 1, biche: 1 },   // A02
  { bucheron: 3, mouton: 4, ours: 4, loup: 3, cerf: 1, biche: 1 },   // A03
  { bucheron: 4, mouton: 3, ours: 3, loup: 4, cerf: 1, biche: 1 },   // A04
  { bucheron: 4, mouton: 4, ours: 2, loup: 4, cerf: 1, biche: 1 },   // A05
  { bucheron: 4, mouton: 4, ours: 2, loup: 2, cerf: 2, biche: 2 },   // A06
  { bucheron: 3, mouton: 3, ours: 4, loup: 4, cerf: 1, biche: 1 },   // A07
  { bucheron: 3, mouton: 4, ours: 3, loup: 4, cerf: 1, biche: 1 },   // A08
  { bucheron: 4, mouton: 3, ours: 2, loup: 3, cerf: 2, biche: 2 },   // A09
  { bucheron: 3, mouton: 3, ours: 3, loup: 3, cerf: 2, biche: 2 },   // A10
  { bucheron: 4, mouton: 2, ours: 4, loup: 2, cerf: 2, biche: 2 },   // A11
  { bucheron: 2, mouton: 4, ours: 4, loup: 2, cerf: 2, biche: 2 },   // A12

  // ── Famille B — Avec ruche (ours ≤ 2 : invariant I11) ──────────────────────
  { ruche: 1, ours: 1, bucheron: 4, mouton: 4, loup: 4, cerf: 1, biche: 1 },  // B01
  { ruche: 1, ours: 2, bucheron: 4, mouton: 4, loup: 3, cerf: 1, biche: 1 },  // B02
  { ruche: 1, ours: 2, bucheron: 4, mouton: 3, loup: 4, cerf: 1, biche: 1 },  // B03
  { ruche: 1, ours: 1, bucheron: 4, mouton: 4, loup: 2, cerf: 2, biche: 2 },  // B04
  { ruche: 1, ours: 2, bucheron: 4, mouton: 2, loup: 3, cerf: 2, biche: 2 },  // B05
  { ruche: 1, ours: 2, bucheron: 3, mouton: 3, loup: 3, cerf: 2, biche: 2 },  // B06
  { ruche: 1, ours: 1, bucheron: 4, mouton: 3, loup: 3, cerf: 2, biche: 2 },  // B07
  { ruche: 1, ours: 2, bucheron: 4, mouton: 3, loup: 2, cerf: 2, biche: 2 },  // B08
  { ruche: 1, ours: 1, bucheron: 3, mouton: 3, loup: 4, cerf: 2, biche: 2 },  // B09
  { ruche: 1, ours: 2, bucheron: 3, mouton: 4, loup: 2, cerf: 2, biche: 2 },  // B10

  // ── Famille C — Avec champignon (cases centrales uniquement) ───────────────
  // champignon ≤ 2 (I8 modifié), placeable sur specialCells.center = [5,6,9,10]
  { champignon: 1, bucheron: 4, mouton: 4, loup: 3, cerf: 2, biche: 2 },         // C01
  { champignon: 1, bucheron: 4, mouton: 3, ours: 4, loup: 2, cerf: 1, biche: 1 }, // C02
  { champignon: 2, bucheron: 4, mouton: 4, ours: 2, loup: 2, cerf: 1, biche: 1 }, // C03
  { champignon: 2, bucheron: 4, mouton: 3, ours: 3, loup: 2, cerf: 1, biche: 1 }, // C04
  { champignon: 1, bucheron: 4, mouton: 3, ours: 3, loup: 3, cerf: 1, biche: 1 }, // C05
  { champignon: 2, bucheron: 4, mouton: 4, ours: 2, loup: 4 },                    // C06
  { champignon: 2, bucheron: 3, mouton: 4, ours: 3, loup: 2, cerf: 1, biche: 1 }, // C07
  { champignon: 1, bucheron: 3, mouton: 4, ours: 4, loup: 2, cerf: 1, biche: 1 }, // C08

  // ── Famille D — Cerf/biche dominants ───────────────────────────────────────
  { cerf: 4, biche: 4, bucheron: 4, mouton: 2, loup: 2 },            // D01
  { cerf: 3, biche: 3, bucheron: 4, mouton: 3, ours: 3 },            // D02
  { cerf: 3, biche: 3, bucheron: 4, mouton: 2, ours: 2, loup: 2 },   // D03
  { cerf: 2, biche: 2, bucheron: 4, mouton: 4, ours: 2, loup: 2 },   // D04
  { cerf: 2, biche: 2, bucheron: 4, mouton: 3, ours: 3, loup: 2 },   // D05
  { cerf: 2, biche: 2, bucheron: 3, mouton: 4, ours: 3, loup: 2 },   // D06

  // ── Famille E — 7–8 types (ruche + champignon simultanés) ───────────────────
  // Retirées : combinaison ruche (voisinage ours strict) + champignon (center_only)
  // + cerf/biche (paired_specific) + contrainte row_col_unique → espace de recherche
  // trop restreint, le solveur ne converge pas de manière fiable sur mobile.
  // Les familles A–D couvrent suffisamment la diversité pédagogique.
];

// ── Nettoyage : retirer les compositions avec count=0 ou Σ ≠ 16 ──────────────
// (la composition invalide avec cerf:0 a été laissée commentée ci-dessus
//  pour documenter l'intention — elle sera filtrée par isONFCompositionValid)

// ── Progression de difficulté ─────────────────────────────────────────────────

/**
 * Nombre de cases fixes selon la progression du joueur.
 * Plus de fixes = plus facile.
 */
function getFixedCount(solvedCount: number): number {
  if (solvedCount < 5)  return 6; // débutant  : 10 cases à placer
  if (solvedCount < 20) return 4; // régulier  : 12 cases à placer
  return 3;                       // confirmé  : 13 cases à placer
}

// ── Générateur principal ──────────────────────────────────────────────────────

const MAX_ATTEMPTS = 40;

/**
 * Génère un défi ONF 4×4.
 *
 * @param solvedCount   Nombre de grilles ONF déjà résolues (pour la progression)
 * @param lastCompoKey  Clé de la dernière composition jouée (anti-répétition)
 * @param rng           Fonction RNG optionnelle
 */
export function generateOnfChallenge(
  solvedCount: number = 0,
  lastCompoKey: string | null = null,
  rng?: RngFunction,
): Challenge | null {
  const rngFn       = rng ?? Math.random;
  const boardDef    = board4x4Onf;
  const elementDefs = ElementRegistry;
  const gridMeta    = boardDef.gridMeta!;
  const gridSize    = 4;

  const fixedCount  = getFixedCount(solvedCount);
  const challengeId = `onf_4x4_${Date.now()}`;

  // Mélanger les compositions, puis reléguer la dernière jouée en fin
  // (anti-répétition sans exclusion stricte).
  let shuffled = seededShuffle(ONF_COMPOSITIONS_4X4, rngFn);
  if (lastCompoKey) {
    const lastIdx = shuffled.findIndex(c => compositionKey(c) === lastCompoKey);
    if (lastIdx !== -1) {
      const [last] = shuffled.splice(lastIdx, 1);
      shuffled.push(last);
    }
  }

  let totalAttempts = 0;

  for (const composition of shuffled) {
    if (totalAttempts >= MAX_ATTEMPTS) break;

    // Construire l'inventaire complet
    const fullTokens: TokenCount[] = [];
    for (const [elementId, count] of Object.entries(composition)) {
      if ((count as number) > 0) {
        fullTokens.push({ elementId, count: count as number });
      }
    }

    // I1 : Σ = 16
    const totalTokens = fullTokens.reduce((acc, t) => acc + t.count, 0);
    if (totalTokens !== boardDef.cellCount) continue;

    // Invariants I2–I10
    if (!isONFCompositionValid(fullTokens, gridSize)) continue;

    for (let attempt = 0; attempt < 5; attempt++) {
      totalAttempts++;
      if (totalAttempts > MAX_ATTEMPTS) break;

      // 1. Trouver UNE solution complète (maxSolutions=1 pour ne pas explorer inutilement)
      const solverResult = solveOnf({
        boardDef,
        fixedPlacements: [],
        availableTokens: fullTokens,
        elementDefs,
        rng: rngFn,
        gridMeta,
        maxSolutions: 1,
      });

      if (solverResult.solutionCount === 0) continue;

      const solution = solverResult.solutions[0];

      // 2. Choisir fixedCount cases aléatoirement
      const allIndices      = Array.from({ length: boardDef.cellCount }, (_, i) => i);
      const shuffledIndices = seededShuffle(allIndices, rngFn);
      const fixedIndices    = shuffledIndices.slice(0, fixedCount);

      const fixedPlacements: FixedPlacement[] = fixedIndices.map(cellIndex => ({
        cellIndex,
        elementId: solution[cellIndex],
      }));

      // 3. Inventaire restant
      const fixedCounts: Record<string, number> = {};
      for (const fp of fixedPlacements) {
        fixedCounts[fp.elementId] = (fixedCounts[fp.elementId] ?? 0) + 1;
      }

      const availableTokens: TokenCount[] = fullTokens
        .map(t => ({
          elementId: t.elementId,
          count: t.count - (fixedCounts[t.elementId] ?? 0),
        }))
        .filter(t => t.count > 0);

      // 4. Vérifier l'unicité
      const uniquenessCheck = solveOnf({
        boardDef,
        fixedPlacements,
        availableTokens,
        elementDefs,
        rng: rngFn,
        gridMeta,
      });

      if (!uniquenessCheck.isUnique) continue;

      return {
        id: challengeId,
        boardId: boardDef.id,
        level: 'niveau_1' as any,
        levelNumber: 0,
        challengeNumber: 0,
        fixedPlacements,
        availableTokens,
        solution,
        solutionCount: 1,
        estimatedDuration: 300,
        _onfCompoKey: compositionKey(composition),
        createdAt: new Date().toISOString(),
      } as Challenge & { _onfCompoKey: string };
    }
  }

  console.error(`[ONF] Échec après ${totalAttempts} tentatives`);
  return null;
}

// ── Clé de composition (anti-répétition) ─────────────────────────────────────

export function compositionKey(composition: Composition): string {
  return Object.entries(composition)
    .filter(([, v]) => (v as number) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}

// ── Validation des invariants ─────────────────────────────────────────────────
//
// I2  : ruche ≤ 1
// I3  : ours ≥ 1 si ruche = 1
// I4  : chien exclu
// I5  : cerf = biche
// I6  : bucheron ≥ chalet
// I7  : bucheron ≥ 1 si tas_buches > 0
// I8  : champignon ≤ 2 (center_only — 4 cases centrales disponibles en 4×4)
// I9  : count(element) ≤ gridSize
// I10 : au moins 2 éléments distincts
// I11 : si ruche = 1 → ours ≤ 2 (voisinage ruche très contraignant en sudoku)
// I12 : champignon ≤ 4 (nb de specialCells.center sur board 4×4)
//
function isONFCompositionValid(tokens: TokenCount[], gridSize: number): boolean {
  const counts: Record<string, number> = {};
  for (const t of tokens) counts[t.elementId] = t.count;

  const get = (id: string) => counts[id] ?? 0;

  if (get('ruche') > 1)                                       return false; // I2
  if (get('ruche') === 1 && get('ours') === 0)                return false; // I3
  if (get('chien') > 0)                                       return false; // I4
  if (get('cerf') !== get('biche'))                           return false; // I5
  if (get('chalet') > 0 && get('bucheron') < get('chalet'))  return false; // I6
  if (get('tas_buches') > 0 && get('bucheron') === 0)         return false; // I7
  if (get('champignon') > 2)                                  return false; // I8 (levé : ≤ 2 autorisé)
  if (get('ruche') === 1 && get('ours') > 2)                  return false; // I11
  if (get('champignon') > 4)                                  return false; // I12 (4 cases centrales)

  // I9 : count ≤ gridSize pour chaque élément
  // (garantit qu'au moins une disposition satisfaisant max-1-par-ligne est possible)
  for (const t of tokens) {
    if (t.count > gridSize) return false;
  }

  // I10 : au moins 2 éléments distincts
  if (tokens.length < 2) return false;

  return true;
}

// ── Récompense ────────────────────────────────────────────────────────────────

/**
 * 4×4 : 5 graines de base + 2 bonus si résolu en moins de 120 s.
 */
export function calculateOnfReward(elapsedMs: number): number {
  return 5 + (elapsedMs < 120_000 ? 2 : 0);
}
