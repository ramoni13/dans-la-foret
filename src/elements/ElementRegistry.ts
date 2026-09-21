// ============================================================
// REGISTRE DES ÉLÉMENTS
// Ajouter un nouvel élément = créer son fichier + une ligne ici
// ============================================================

import { ElementDefinition } from '../core/models/Element';
import { bucheronDef } from './bucheron';
import { oursDef } from './ours';
import { moutonDef } from './mouton';
import { chienDef } from './chien';
import { chaletDef } from './chalet';
import { renardDef } from './renard';
import { rucheDef } from './ruche';
import { cerfDef } from './cerf';
import { bicheDef } from './biche';
import { tasBuchesDef } from './tas_buches';

export const ElementRegistry: Record<string, ElementDefinition> = {
  // ── Éléments de base (jeu physique Djeco) ──────────────────────────────
  bucheron: bucheronDef,
  ours: oursDef,
  mouton: moutonDef,
  chien: chienDef,       // meute connexe (connected_group)
  chalet: chaletDef,
  renard: renardDef,
  // ── Nouveaux éléments (application numérique) ────────────────────────
  ruche: rucheDef,       // singleton, voisin ours requis
  cerf: cerfDef,         // paired_specific avec biche
  biche: bicheDef,       // paired_specific avec cerf
  tas_buches: tasBuchesDef, // neighbor_specific_chain (bucheron + chalet conditionnel)
};
