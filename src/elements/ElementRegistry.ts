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

export const ElementRegistry: Record<string, ElementDefinition> = {
  bucheron: bucheronDef,
  ours: oursDef,
  mouton: moutonDef,
  chien: chienDef,
  chalet: chaletDef,
  renard: renardDef,
  // 👇 Ajouter un nouvel élément ici
  // panneau: panneauDef,
};
