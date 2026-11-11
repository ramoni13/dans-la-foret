// ============================================================
// pinecone — les pommes de pin remplacent les étoiles (thème forestier)
//
// Trois visuels (assets/elements/design_app) :
//   empty = PP_vide2  : emplacement non obtenu ;
//   wood  = PP_bois   : 1 ou 2 pommes de pin obtenues ;
//   gold  = PP_or     : les 3 obtenues (compteurs : toujours dorée).
//
// Le MODÈLE de données ne change pas (`challengeStars`, `StarSequence`… gardent leur nom : ce sont des
// identifiants internes et des champs Firestore). Seul ce qui est AFFICHÉ change.
//
// Fichier PUR (aucune dépendance React) : testé par __tests__/pinecone.test.ts.
// ============================================================

import type { StarSequence, StarSlotState } from './progression';

export type PineconeVariant = 'empty' | 'wood' | 'gold';

/** Les trois PNG ont la même taille : 284 × 353 (largeur / hauteur). */
export const PINECONE_ASPECT = 284 / 353;

/**
 * Jeton à écrire dans un texte traduit pour y insérer une petite pomme de pin dorée (remplace l'ancien ⭐).
 * Rendu par `PineconeText` ; les libellés d'accessibilité n'en contiennent jamais (mots écrits).
 */
export const PINECONE_TOKEN = '[pp]';

export type PineconeTextPart = { type: 'text'; value: string } | { type: 'pp' };

/** Découpe un texte en morceaux de texte et en pommes de pin (jeton `[pp]`). */
export function splitPineconeText(text: string): PineconeTextPart[] {
  const parts: PineconeTextPart[] = [];
  const pieces = text.split(PINECONE_TOKEN);
  pieces.forEach((value, i) => {
    if (value) parts.push({ type: 'text', value });
    if (i < pieces.length - 1) parts.push({ type: 'pp' });
  });
  return parts;
}

/** Texte sans jeton (utile aux libellés d'accessibilité) : `[pp]` devient `replacement`. */
export function stripPineconeToken(text: string, replacement = ''): string {
  return text.split(PINECONE_TOKEN).join(replacement);
}

/** Visuel d'un emplacement une fois la séquence terminée, hors transformation en or. */
export function getPineconeVariant(state: StarSlotState): PineconeVariant {
  return state === 'missed' ? 'empty' : 'wood';
}

/**
 * La transformation « 3 bois → 3 dorées » (fête + confettis) ne se joue que si la 3e pomme de pin est
 * OBTENUE CE TOUR-CI. Rejouer un défi déjà à 3 : les trois dorées s'affichent d'emblée, sans fête.
 */
export function shouldTransform(seq: StarSequence): boolean {
  return seq.slots[2] === 'new';
}

/** true = les 3 pommes de pin sont dorées dès l'ouverture, sans animation (défi déjà à 3, rien de nouveau). */
export function isStaticGold(seq: StarSequence): boolean {
  return seq.bestStars === 3 && !shouldTransform(seq);
}

/** Visuel de chaque emplacement à l'OUVERTURE de la modale (les nouveaux partent du vide). */
export function getInitialVariants(seq: StarSequence): PineconeVariant[] {
  const gold = isStaticGold(seq);
  return seq.slots.map(s => (s === 'new' ? 'empty' : s === 'owned' ? (gold ? 'gold' : 'wood') : 'empty'));
}

/** Visuel de chaque emplacement à la FIN de la séquence. */
export function getFinalVariants(seq: StarSequence): PineconeVariant[] {
  if (seq.bestStars === 3) return ['gold', 'gold', 'gold'];
  return seq.slots.map(getPineconeVariant);
}

/** Visuels d'une note de 0 à 3 (listes de défis) : 3 → trois dorées, 1 ou 2 → bois puis vides, 0 → trois vides. */
export function getRatingVariants(stars: number): PineconeVariant[] {
  const n = Math.max(0, Math.min(3, Math.floor(stars || 0)));
  if (n === 3) return ['gold', 'gold', 'gold'];
  return [0, 1, 2].map(i => (i < n ? 'wood' : 'empty'));
}

// ── Chronologie de la transformation (ms) ────────────────────────────────────

/** Pause entre le pop de la dernière pomme de pin et la transformation en or. */
export const PINECONE_TRANSFORM_DELAY_MS = 380;
/** Durée du fondu bois → or (avec le rebond des trois). */
export const PINECONE_TRANSFORM_DURATION_MS = 260;
/** Temps laissé à la fête avant de passer à la jauge. */
export const PINECONE_CELEBRATION_MS = 700;

// ── Éclats de confettis / feu d'artifice ─────────────────────────────────────

export const BURST_COLORS = ['#FFD700', '#FFC107', '#FF9800', '#FF6B35', '#FFF3B0', '#8BC34A', '#4CAF50', '#FFFFFF'] as const;

export interface BurstParticle {
  /** Déplacement final par rapport au centre du tir (px). */
  dx: number;
  dy: number;
  size: number;
  color: string;
  /** Retard de départ (ms). */
  delay: number;
  /** Demi-tours pendant le vol. */
  spin: number;
  round: boolean;
}

/** PRNG déterministe (mulberry32) : le même tir donne les mêmes particules (testable, sans Math.random). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Particules d'un tir : réparties à peu près régulièrement sur 360° (une gerbe de feu d'artifice),
 * avec une portée et une taille variables, puis retombée par la gravité (ajoutée par le composant).
 */
export function buildBurstParticles(count: number, radius: number, seed = 1): BurstParticle[] {
  const rand = mulberry32(seed);
  const n = Math.max(0, Math.floor(count));
  const out: BurstParticle[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const reach = radius * (0.55 + rand() * 0.45);
    out.push({
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach,
      size: 5 + rand() * 6,
      color: BURST_COLORS[Math.floor(rand() * BURST_COLORS.length)],
      delay: Math.floor(rand() * 60),
      spin: 1 + Math.floor(rand() * 3),
      round: rand() < 0.4,
    });
  }
  return out;
}
