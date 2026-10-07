# Plan : Réorganisation des éléments, niveaux et règle ruche

## Résumé des décisions

### D1 — Nouvelle règle ruche
**"Tous les ours du plateau doivent être voisins directs de la ruche."**
L'ours a `neighbor_same: forbid` (2 ours ne peuvent pas être voisins). Donc une chaîne ours-ours-ruche est impossible. La seule interprétation cohérente : chaque ours doit toucher la ruche directement. Cela limite le nombre d'ours au nombre de voisins de la case ruche (2-5 selon la topologie).

Approche d'implémentation : **pas de nouveau ConstraintType**. On inverse la direction de la contrainte existante : au lieu que la ruche "require ours voisin", c'est l'ours qui "require ruche voisin" (`neighbor_specific require ruche`), **plus** la contrainte globale que la ruche `maxPerBoard: 1` (déjà en place). Cela suffit : si chaque ours doit être voisin de la ruche (unique), tous les ours sont automatiquement connectés à la ruche.

Changement concret dans `ruche.ts` : remplacer `neighbor_specific require ours` par rien (ou garder pour rétrocompatibilité — elle sera toujours satisfaite si tous les ours sont voisins de la ruche). Dans `ours.ts` : ajouter `neighbor_specific require ruche` avec `mode: 'require'`, **conditionné à la présence d'une ruche sur le plateau** — sinon un défi sans ruche serait injouable pour les ours.

**Point critique** : le type `neighbor_specific require` actuel est simple — "je dois avoir ≥1 voisin de type X". Si on l'applique à l'ours avec target=ruche, alors dans un défi SANS ruche (qui existe dans beaucoup de compositions), l'ours serait toujours en violation. Il faut donc un comportement **conditionnel** : "si une ruche est présente sur le plateau, je dois en être voisin".

→ **Solution retenue** : Ajouter un nouveau `ConstraintType` = `'conditional_neighbor'` (ou réutiliser le champ `chainTargetElementId` de `neighbor_specific_chain`). Le plus propre est d'ajouter un flag `onlyIfTargetOnBoard: true` au `ConstraintDefinition`, et de le gérer dans le validator/solver/hintEngine. Alternative plus simple : gérer dans le validator en vérifiant `board.includes(targetElementId)` avant d'appliquer la contrainte `neighbor_specific require`.

### D2 — Niveau 1 : 3 éléments (bucheron, ours, mouton)
Tu as raison, 2 éléments c'est trop plat. Avec seulement bucheron+ours sur 6 cases et 3 vides, la seule règle est "pas de voisin identique" — c'est un damier trivial. Le mouton au niveau 1 ajoute un 3e type avec la même règle, ce qui augmente la combinatoire sans ajouter de complexité cognitive (même mécanique de repulsion). C'est le sweet spot d'onboarding.

**Ruche retirée du niveau 1** — elle sera introduite plus tard avec sa nouvelle règle plus riche.

### D3 — 10 défis par niveau : conserver

**Verdict : garder 10 défis par niveau.**

Un joueur a fini les 150 défis en 2h cumulées = **48 secondes par défi en moyenne**. Certains défis sont résolus en **10 secondes ou moins**. Le problème n'est pas le nombre de défis — c'est que chaque défi individuel est trop facile.

Réduire le nombre de défis aggraverait le problème : le joueur finirait en 1h20 au lieu de 2h. 10 défis par niveau reste correct :
- C'est le standard des puzzle games mobiles (*Candy Crush* : 10-15 niveaux par "monde", *Nonogram* : 10+ par catégorie)
- 10 défis permettent au generator de produire une bonne diversité structurelle (compositions variées, signatures de solutions différentes)
- Le levier correct est de rendre **chaque défi plus difficile** en augmentant les cases vides (axe B)

### D4 — Nouvelle répartition des éléments par niveau (+ cases vides augmentées)

**Diagnostic du problème de densité** : 150 défis en 2h = 48s/défi en moyenne. Les `estimatedDurationRange` du code (60-1500s) sont totalement décalés de la réalité. Le ratio cases_vides/cases_totales actuel est trop bas :

| Niv actuel | Cases | Vides | Ratio | Jetons à placer | Verdict |
|------------|-------|-------|-------|-----------------|---------|
| 1 | 6 | 3 | 50% | 3 | Trivial |
| 3 | 8 | 3 | 37% | 5 fixés / 3 à placer | Cadeau |
| 6 | 9 | 4 | 44% | 5 fixés / 4 à placer | Trop facile |
| 9 | 10 | 4 | 40% | 6 fixés / 4 à placer | Cadeau |

Les niveaux "respiration" actuels (nouveau plateau, vides réduits) réduisent la difficulté — un bon joueur les résout en secondes. La solution : les paliers de respiration gardent les **mêmes éléments** sur un **nouveau plateau** avec **+1 case vide** vs le niveau précédent. La familiarité des règles crée la respiration, mais le nombre de vides ne descend jamais.

**Principes de la courbe de difficulté :**

1. **Montée progressive** : chaque niveau augmente la difficulté soit par +1 case vide, soit par un nouvel élément/contrainte. La sensation est toujours ascendante.
2. **Palier de respiration = nouveau plateau** : quand on change de board (plus de cases), les vides restent ou augmentent légèrement. Le joueur "respire" grâce à la familiarité des règles + plus de jetons fixes (3-5 au lieu de 2-3).
3. **Accélération = même plateau** : sur le même board, +1 case vide sans nouvel élément.
4. **Respiration franche niv 12** : passage au board 12 + introduction chalet = gros saut cognitif. Les vides redescendent de 8 à 7 (seule exception). Justifié par : 12 cases × 10 types d'éléments × chaîne complète bucheron→bûches→chalet.
5. **Plafond à 8 vides / 12 cases** (niv 14-15). Les niveaux 16+ avec grilles 13-14 cases permettront d'aller plus loin.

| Niv | Board | Cases | Vides | Fixés | Ratio | Nouveaux éléments | Type de niveau |
|-----|-------|-------|-------|-------|-------|-------------------|----------------|
| **1** | board_6_v1 | 6 | 3 | 3 | 50% | bucheron, ours, mouton | Onboarding : 1 mécanique (repulsion) × 3 types |
| **2** | board_7_v1 | 7 | 4 | 3 | 57% | *(aucun)* | Respiration (nouveau board) — mêmes règles, +1 vide |
| **3** | board_8_v2 | 8 | 4 | 4 | 50% | **chien** | Respiration (nouveau board) — chien (meute connexe). 4 fixés = accueil doux |
| **4** | board_8_v2 | 8 | 5 | 3 | 63% | *(aucun)* | Accélération — même board, +1 vide. Consolidation chien+repulsion |
| **5** | board_9_v1 | 9 | 5 | 4 | 56% | **renard** | Respiration (nouveau board) — renard↔mouton antagonisme. 4 fixés |
| **6** | board_9_v1 | 9 | 6 | 3 | 67% | *(aucun)* | Accélération — même board, +1 vide. 3 fixés seulement |
| **7** | board_10_v3 | 10 | 6 | 4 | 60% | **ruche** | Respiration (nouveau board) — ruche singleton + tous ours voisins. 4 fixés |
| **8** | board_10_v3 | 10 | 7 | 3 | 70% | *(aucun)* | Accélération — même board, +1 vide. Consolidation ruche+renard+chien |
| **9** | board_11_v2 | 11 | 7 | 4 | 64% | **cerf, biche** | Respiration (nouveau board) — paires couplées. 4 fixés |
| **10** | board_11_v2 | 11 | 8 | 3 | 73% | *(aucun)* | Accélération — même board, +1 vide. 8 types, 3 fixés |
| **11** | board_11_v2 | 11 | 8 | 3 | 73% | **tas_buches** | Même vides — nouvel élément (chaînage bucheron→bûches) = complexité via contrainte |
| **12** | board_12 | 12 | 7 | 5 | 58% | **chalet** | **Respiration franche** (nouveau board 12 + chalet). Vides ↓ de 8→7, mais 12 cases × 10 types × chaîne complète = cognitif lourd. 5 fixés = confortable |
| **13** | board_12 | 12 | 7 | 5 | 58% | *(aucun)* | Même vides — consolidation. Compositions variées avec tous les 10 types |
| **14** | board_12 | 12 | 8 | 4 | 67% | *(aucun)* | Accélération — +1 vide. 4 fixés. Max contraintes actives |
| **15** | board_12 | 12 | 8 | 4 | 67% | *(bonus désactivés)* | Même vides — MAIS aucun bonus. Le joueur est seul |

**Vérification de la courbe :**
```
Vides : 3 → 4 → 4 → 5 → 5 → 6 → 6 → 7 → 7 → 8 → 8 → 7 → 7 → 8 → 8
         ↑   =   ↑   =   ↑   =   ↑   =   ↑   =   ↓   =   ↑   =
Fixés : 3   3   4   3   4   3   4   3   4   3   3   5   5   4   4
```
La courbe monte régulièrement avec un pattern clair **alternant introduction (+1 fixé, respiration) et accélération (-1 fixé, +1 vide)**. Seule exception : niv 11→12 où les vides descendent de 8→7, compensé par le saut cognitif majeur (nouveau board + chalet + 10 types).

**Pattern récurrent (sauf niv 12) :**
- **Niveaux impairs (3,5,7,9)** : nouveau board OU nouvel élément, 4 fixés → accueil
- **Niveaux pairs (4,6,8,10)** : même board, +1 vide, 3 fixés → accélération

**Comparaison avec l'actuel :**

| Niv | Vides actuel | Vides proposé | Diff | Commentaire |
|-----|-------------|---------------|------|-------------|
| 1 | 3 | 3 | = | Identique |
| 2 | 4 | 4 | = | Identique |
| 3 | 3 | 4 | **+1** | Plus de challenge dès l'intro chien |
| 4 | 4 | 5 | **+1** | |
| 5 | 5 | 5 | = | Renard avancé au niv 5 (était niv 8) |
| 6 | 4 | 6 | **+2** | Plus de palier "cadeau" |
| 7 | 5 | 6 | **+1** | Ruche avancée au niv 7 (était niv 1) |
| 8 | 5 | 7 | **+2** | |
| 9 | 4 | 7 | **+3** | Cerf/biche avancés (était niv 5) |
| 10 | 5 | 8 | **+3** | |
| 11 | 5 | 8 | **+3** | |
| 12 | 6 | 7 | **+1** | |
| 13 | 7 | 7 | = | |
| 14 | 8 | 8 | = | |
| 15 | 9 | 8 | **-1** | Plafond 8 au lieu de 9 (niv 16+ prendront le relais) |

**Impact temps de jeu estimé** : Avec 3-5 fixés et des contraintes multi-éléments, chaque défi devrait prendre 30s-2 min (niveaux 1-6), 2-5 min (niveaux 7-11), et 3-10 min (niveaux 12-15). Total estimé : **6h à 15h** pour 150 défis (vs 2h actuel). Les niveaux 16+ allongeront encore.

**Niveaux 16+ (hors scope, prévu plus tard)** : grilles 13-14 cases, 9-10 vides. Permettront de repousser le plafond de difficulté.

### D5 — Rendre le jeu plus dense : stratégie retenue

**Axe B — Défis individuellement plus difficiles.** Les leviers combinés :

1. **Cases vides augmentées de +1 à +3** par rapport à l'actuel (D4 ci-dessus) — levier principal. Chaque case vide supplémentaire multiplie l'espace de recherche.
2. **Paliers de respiration = nouveau board + 1 fixé supplémentaire** — quand un nouveau plateau arrive, on introduit un nouvel élément avec +1 fixé (4 au lieu de 3). La respiration vient de la familiarité des anciennes règles + un guide plus généreux. Le nombre de vides ne baisse jamais (sauf niv 12, respiration franche justifiée).
3. **Accélérations = même board, +1 vide, -1 fixé** — entre deux plateaux, on retire un fixé et on ajoute un vide. Pattern régulier et prévisible pour le joueur.
4. **Introduction du renard au niv 5** (au lieu de 8) — les interactions antagonistes arrivent tôt.
5. **Nouvelle règle ruche** (tous ours voisins) — au niv 7, contrainte spatiale forte.
6. **10 défis par niveau conservés** — chaque défi est plus long, donc le temps total augmente massivement.
7. **Plafond à 8 vides / 12 cases** — conservateur et fiable. Les niveaux 16+ avec grilles 13-14 cases permettront 9-10 vides.

### D6 — Invariants composition mis à jour

Les invariants existants restent valides. Un nouvel invariant s'ajoute :

| Code | Règle | Changement |
|------|-------|------------|
| I1 | Σ éléments = cellCount | Inchangé |
| I2 | ruche ≤ 1 | Inchangé |
| I3 | ours ≥ 1 si ruche = 1 | Inchangé |
| **I3b** | **Si ruche = 1, ours ≤ max_voisins(ruche_cell)** | **NOUVEAU** — nombre d'ours limité par la topologie. En pratique ≤ 5 (hub du board_8). Le generator devra valider. |
| I4 | chien ≥ 2 si chien > 0 | Inchangé |
| I5 | cerf = biche | Inchangé |
| I6 | bucheron ≥ chalet | Inchangé |
| I7 | bucheron ≥ 1 si tas_buches > 0 | Inchangé |

Note : I3b est un invariant *mou* — il dépend de la case où la ruche atterrit (pas contrôlable à la composition). Le generator doit le vérifier a posteriori via le solver. En pratique, limiter ours ≤ 3 quand ruche=1 est sûr pour tous les boards.

---

## Fichiers impactés — Ordre d'exécution

### Phase 1 — Modèle & Moteur (fondations)

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 1.1 | `src/core/models/Element.ts` | Modifier | Ajouter champ optionnel `onlyIfTargetOnBoard?: boolean` à `ConstraintDefinition` |
| 1.2 | `src/elements/ruche.ts` | Modifier | Retirer `neighbor_specific require ours`. Garder `singleton`. La ruche n'a plus de contrainte de voisinage propre (c'est l'ours qui doit venir à elle). |
| 1.3 | `src/elements/ours.ts` | Modifier | Ajouter contrainte : `{ type: 'neighbor_specific', targetElementId: 'ruche', mode: 'require', scope: 'neighbor', onlyIfTargetOnBoard: true }` — "si une ruche existe, chaque ours doit être son voisin" |
| 1.4 | `src/core/engine/validator.ts` | Modifier | Dans le traitement de `neighbor_specific` require : si `onlyIfTargetOnBoard === true`, vérifier d'abord que `board.includes(targetElementId)`. Si non présent → skip (pas de violation). |
| 1.5 | `src/core/engine/solver.ts` | Modifier | Même logique dans `isCompleteSolutionValid()` et `canStillSatisfyRequireConstraints()`. Pour le pruning : si ruche est sur le board ET un ours n'a pas de voisin ruche ET pas de case vide adjacente à la ruche → prune. |
| 1.6 | `src/core/engine/hintEngine.ts` | Modifier | Dans `getValidCellsForElement()` : pour ours avec `onlyIfTargetOnBoard`, si ruche placée → ours ne peut aller que sur cases voisines de la ruche. Si ruche pas placée → pas de restriction (la ruche pourrait aller n'importe où ensuite). |

### Phase 2 — Niveaux & Compositions

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 2.1 | `src/constants/difficulty.ts` | **Refonte majeure** | Réécrire toutes les compositions pour les 15 niveaux selon la grille D4 : niv 1 (6c/3v), niv 2 (7c/4v), niv 3 (8c/4v+chien), niv 4 (8c/5v), niv 5 (9c/5v+renard), niv 6 (9c/6v), niv 7 (10c/6v+ruche), niv 8 (10c/7v), niv 9 (11c/7v+cerf/biche), niv 10 (11c/8v), niv 11 (11c/8v+buches), niv 12 (12c/7v+chalet), niv 13 (12c/7v), niv 14 (12c/8v), niv 15 (12c/8v+bonus off). Retirer la ruche des niveaux 1-6. Mettre à jour `estimatedDurationRange`. |
| 2.2 | `src/data/levelMeta.ts` | **Refonte majeure** | Réassigner `newElements`, `newRules`, `allRules` pour chaque niveau. Nouvelles RuleCard pour la règle ruche modifiée. |
| 2.3 | `scripts/generateChallenges.ts` | Vérifier | Garder `count: 10` pour tous les niveaux. Vérifier compatibilité avec les nouvelles compositions et les cases vides augmentées. Le solver pourrait être plus lent avec 10-11 vides → augmenter `maxAttempts` si nécessaire. |
| 2.4 | `src/core/generators/challengeGenerator.ts` | Vérifier/adapter | La validation pédagogique (renard-sans-mouton, etc.) doit être revue : le renard apparaît maintenant au niv 4 (pas 8). Vérifier que la logique reste cohérente. Ajouter validation pour la nouvelle contrainte ruche/ours : si ruche=1, vérifier que la solution a bien tous les ours voisins de la ruche. **Adapter la logique de retrait de jetons** : avec plus de vides ciblés, le generator doit retirer plus de jetons → vérifier que `targetEmptyCells` est bien piloté par `emptyCellsRange`. |

### Phase 3 — Daily Challenge

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 3.1 | `src/services/dailyChallengeService.ts` | Modifier | Les 16 compositions des familles B (ruche), E (full-house) doivent respecter le nouvel invariant I3b. Sur board_15_daily, vérifier le nombre max de voisins par case. Les compositions actuelles ont ours=2-3 quand ruche=1 → probablement compatible mais à valider. |

### Phase 4 — UI, Briefing, Rules

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 4.1 | `app/(tabs)/rules.tsx` | Modifier | Mettre à jour `ELEMENT_ORDER` : nouvel `introLevel` pour chaque élément, nouvelles `ruleIds`. Ruche passe de introLevel 1 → 7. Renard de 8 → 5. Cerf/biche de 5 → 9. Tas_buches de 12 → 11. Chalet de 13 → 12. |
| 4.2 | `src/data/levelMeta.ts` | (déjà en 2.2) | Ajouter une RuleCard pour la nouvelle règle ruche : `require_ours_ruche` (type `require_neighbor`, elements `['ours', 'ruche']`, i18n `a11y_require_neighbor`, vars `{e1: 'ours', e2: 'ruche'}`). Remplacer `require_ruche_ours`. |
| 4.3 | `src/components/LevelBriefing/RuleCard.tsx` | Vérifier | Aucun changement de code si on reste sur les types d'animation existants (`require_neighbor`, `singleton`). L'animation `RequireNeighborAnim` fonctionne avec n'importe quels éléments. |
| 4.4 | `src/components/LevelBriefing/RuleAnimations/` | Vérifier | Aucun nouveau composant nécessaire. Les animations sont génériques. |

### Phase 5 — i18n

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 5.1 | `src/i18n/locales/fr.json` | Modifier | `rules_desc_ruche` → "Un seul par défi. Tous les ours doivent être voisins de la ruche." Ajouter `a11y_require_ours_ruche` si nouvelle clé. Vérifier que `rules_locked` et `rules_unlocked_at` restent cohérents (dynamiques via `{{level}}`). |
| 5.2 | `src/i18n/locales/en.json` | Modifier | `rules_desc_ruche` → "Only one per puzzle. All bears must be adjacent to the beehive." Même clés. |

### Phase 6 — Régénération & Validation

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 6.1 | `src/data/challenges/niveau_*.json` | Régénérer | `npm run generate` — JAMAIS éditer à la main |
| 6.2 | `scripts/regenerateChallenges.ts` | Vérifier | Doit pointer vers les bons niveaux |
| 6.3 | `scripts/generateViewerData.ts` | Vérifier | Adapter si le format change |
| 6.4 | Tests existants | Adapter | Vérifier/mettre à jour les tests du validator, solver, hintEngine pour couvrir `onlyIfTargetOnBoard` |

### Phase 7 — Vérifications transversales

| Composant | Impact | Action |
|-----------|--------|--------|
| **Badges** | Les badges `exploration_*` comptent les niveaux complétés (1-3, 1-5, 1-9, all) — **pas d'impact** car les niveaux restent 1-15. | Aucune modification |
| **Bonus highlight_valid_cells** | Le hintEngine (modifié en 1.6) gère déjà correctement → **couvert**. | Via 1.6 |
| **Bonus instinct** | Compare playerBoard vs solution (O(n)) → **pas d'impact**. | Aucune modification |
| **Player progression** | Les challenges sont identifiés par `challengeId` (ex: `niveau_1_1`). Si on régénère → les IDs restent les mêmes mais le contenu change. Un joueur ayant complété `niveau_1_3` garde sa progression. | Vérifier que le format d'ID ne change pas |
| **Stores (gameStore, playerStore)** | Aucune modification de structure. | Aucune modification |
| **Audio** | Aucun lien avec les éléments. | Aucune modification |
| **Daily briefing (`DailyBriefingModal`)** | Spécifique au champignon. Pas d'impact. | Aucune modification |
| **Board `availableElements`** | Les boards listent les éléments dispo. Board_6_v1 a `['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard']` — mais cette liste n'est PAS utilisée pour filtrer les compositions (vérifier). Si elle l'est, mettre à jour. | Vérifier & adapter si nécessaire |

---

## Compositions à écrire (Phase 2.1)

10 défis par niveau × 15 niveaux = 150 défis (inchangé).

### Niveau 1 : bucheron, ours, mouton — 6 cases, 3 vides

Compositions (total=6, 3 types uniquement) :
- `{ bucheron: 2, ours: 2, mouton: 2 }`
- `{ bucheron: 3, ours: 2, mouton: 1 }`
- `{ bucheron: 2, ours: 3, mouton: 1 }`
- `{ bucheron: 1, ours: 2, mouton: 3 }`
- `{ bucheron: 3, ours: 1, mouton: 2 }`
- `{ bucheron: 1, ours: 3, mouton: 2 }`
- `{ bucheron: 4, ours: 1, mouton: 1 }`
- `{ bucheron: 1, ours: 1, mouton: 4 }`

### Niveau 2 : bucheron, ours, mouton — 7 cases, 4 vides, 3 fixés (respiration — nouveau board)

Compositions (total=7, 3 types). Mêmes règles, plateau plus grand.
- `{ bucheron: 3, ours: 2, mouton: 2 }`
- `{ bucheron: 2, ours: 3, mouton: 2 }`
- `{ bucheron: 2, ours: 2, mouton: 3 }`
- `{ bucheron: 4, ours: 2, mouton: 1 }`
- `{ bucheron: 1, ours: 4, mouton: 2 }`
- `{ bucheron: 3, ours: 3, mouton: 1 }`
- `{ bucheron: 1, ours: 3, mouton: 3 }`
- `{ bucheron: 3, ours: 1, mouton: 3 }`

### Niveau 3 : + chien — 8 cases, 4 vides, 4 fixés (respiration — nouveau board + chien)

Compositions (total=8, 4 types). chien ≥ 2 (I4). 4 fixés = accueil confortable pour la nouvelle mécanique.
- `{ bucheron: 2, ours: 2, mouton: 2, chien: 2 }`
- `{ bucheron: 3, ours: 1, mouton: 2, chien: 2 }`
- `{ bucheron: 2, ours: 3, mouton: 1, chien: 2 }`
- `{ bucheron: 1, ours: 2, mouton: 3, chien: 2 }`
- `{ bucheron: 3, ours: 2, mouton: 1, chien: 2 }`
- `{ bucheron: 1, ours: 3, mouton: 2, chien: 2 }`
- `{ bucheron: 2, ours: 1, mouton: 2, chien: 3 }`
- `{ bucheron: 1, ours: 2, mouton: 1, chien: 4 }`
- `{ bucheron: 2, ours: 2, mouton: 0, chien: 4 }`
- `{ bucheron: 2, ours: 1, mouton: 1, chien: 4 }`

### Niveau 4 : consolidation — 8 cases, 5 vides, 3 fixés (accélération — +1 vide)

Compositions (total=8, 4 types). Mêmes éléments que niv 3. +1 vide, -1 fixé.
- `{ bucheron: 2, ours: 2, mouton: 2, chien: 2 }`
- `{ bucheron: 3, ours: 2, mouton: 1, chien: 2 }`
- `{ bucheron: 1, ours: 3, mouton: 2, chien: 2 }`
- `{ bucheron: 2, ours: 1, mouton: 2, chien: 3 }`
- `{ bucheron: 1, ours: 2, mouton: 1, chien: 4 }`
- `{ bucheron: 3, ours: 1, mouton: 2, chien: 2 }`
- `{ bucheron: 2, ours: 3, mouton: 1, chien: 2 }`
- `{ bucheron: 1, ours: 1, mouton: 2, chien: 4 }`
- `{ bucheron: 2, ours: 2, mouton: 0, chien: 4 }`
- `{ bucheron: 3, ours: 1, mouton: 1, chien: 3 }`

### Niveau 5 : + renard — 9 cases, 5 vides, 4 fixés (respiration — nouveau board + renard)

Compositions (total=9, 5 types). renard ≥ 1. 4 fixés = accueil pour le renard↔mouton.
- `{ bucheron: 2, ours: 2, mouton: 2, renard: 2, chien: 0, ruche: 0 }` // NON, pas de chien possible sans I4
Attention : sur 9 cases avec 5 types (bucheron, ours, mouton, chien, renard), chien ≥ 2 si présent (I4).
- `{ bucheron: 2, ours: 2, mouton: 2, renard: 1, chien: 2 }` // 9 I1✓ I4✓
- `{ bucheron: 3, ours: 2, mouton: 1, renard: 1, chien: 2 }` // 9 I1✓ I4✓
- `{ bucheron: 2, ours: 3, mouton: 1, renard: 1, chien: 2 }` // 9 I1✓ I4✓
- `{ bucheron: 3, ours: 1, mouton: 2, renard: 1, chien: 2 }` // 9 I1✓ I4✓
- `{ bucheron: 3, ours: 2, mouton: 2, renard: 2 }` // 9 I1✓ (sans chien)
- `{ bucheron: 2, ours: 3, mouton: 2, renard: 2 }` // 9 I1✓
- `{ bucheron: 2, ours: 2, mouton: 3, renard: 2 }` // 9 I1✓
- `{ bucheron: 3, ours: 2, mouton: 1, renard: 3 }` // 9 I1✓ renard dominant
- `{ bucheron: 2, ours: 1, mouton: 2, renard: 2, chien: 2 }` // 9 I1✓ I4✓
- `{ bucheron: 1, ours: 2, mouton: 2, renard: 2, chien: 2 }` // 9 I1✓ I4✓

### Niveau 6 : consolidation — 9 cases, 6 vides, 3 fixés (accélération — +1 vide)

Compositions (total=9, 5 types). Mêmes éléments que niv 5. +1 vide, -1 fixé.
- `{ bucheron: 2, ours: 2, mouton: 2, renard: 1, chien: 2 }` // 9 I1✓ I4✓
- `{ bucheron: 3, ours: 2, mouton: 1, renard: 1, chien: 2 }` // 9
- `{ bucheron: 3, ours: 2, mouton: 2, renard: 2 }` // 9 sans chien
- `{ bucheron: 2, ours: 3, mouton: 2, renard: 2 }` // 9
- `{ bucheron: 2, ours: 2, mouton: 2, renard: 3 }` // 9 renard dominant
- `{ bucheron: 3, ours: 1, mouton: 2, renard: 1, chien: 2 }` // 9
- `{ bucheron: 1, ours: 3, mouton: 2, renard: 1, chien: 2 }` // 9
- `{ bucheron: 2, ours: 1, mouton: 2, renard: 2, chien: 2 }` // 9
- `{ bucheron: 3, ours: 2, mouton: 1, renard: 3 }` // 9 renard dominant
- `{ bucheron: 2, ours: 3, mouton: 1, renard: 3 }` // 9

### Niveau 7 : + ruche — 10 cases, 6 vides, 4 fixés (respiration — nouveau board + ruche)

Compositions (total=10, 6 types). ruche=1, ours ≤ 3 (I3b). 4 fixés.
- `{ bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, ruche: 1 }` // 10 I1✓ I2✓ I3✓ I4✓
- `{ bucheron: 2, ours: 1, mouton: 2, chien: 2, renard: 2, ruche: 1 }` // 10
- `{ bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 2, ruche: 1 }` // 10
- `{ bucheron: 3, ours: 2, mouton: 2, renard: 2, ruche: 1 }` // 10 sans chien
- `{ bucheron: 2, ours: 3, mouton: 2, renard: 2, ruche: 1 }` // 10
- `{ bucheron: 3, ours: 2, mouton: 1, renard: 3, ruche: 1 }` // 10 renard dominant
- `{ bucheron: 2, ours: 2, mouton: 2, renard: 3, ruche: 1 }` // 10
- `{ bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 1 }` // 10 sans ruche (variété)
- `{ bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2 }` // 10 sans ruche
- `{ bucheron: 3, ours: 3, mouton: 1, renard: 2, ruche: 1 }` // 10 ours=3

### Niveau 8 : consolidation — 10 cases, 7 vides, 3 fixés (accélération — +1 vide)

Compositions (total=10, 6 types). Mêmes éléments que niv 7, +1 vide.
Compositions reprises du niv 7 avec ajustements. À finaliser à l'implémentation.

### Niveau 9 : + cerf, biche — 11 cases, 7 vides, 4 fixés (respiration — nouveau board + paires)

Compositions (total=11, 8 types). cerf=biche (I5). 4 fixés.
À écrire à l'implémentation. Compositions similaires aux actuels niv 6-7 adaptées au board 11.

### Niveau 10 : consolidation — 11 cases, 8 vides, 3 fixés (accélération — +1 vide)

Compositions (total=11, 8 types). Mêmes éléments, -1 fixé.
Compositions similaires aux actuels niv 9-10 adaptées.

### Niveau 11 : + tas_buches — 11 cases, 8 vides, 3 fixés (même vides + nouvel élément)

Compositions (total=11, 9 types). tas_buches ≥ 1, bucheron ≥ 1 (I7). Même vides que niv 10, complexité via chaînage.
Compositions similaires aux actuels niv 12.

### Niveau 12 : + chalet — 12 cases, 7 vides, 5 fixés (respiration franche — nouveau board)

Compositions (total=12, 10 types). chalet ≥ 1, bucheron ≥ chalet (I6). 5 fixés = accueil confortable.
Vides redescendent de 8→7 — seule exception. Justifié par le saut cognitif : 12 cases, 10 types, chaîne complète.
Compositions similaires aux actuels niv 13.

### Niveau 13 : consolidation — 12 cases, 7 vides, 5 fixés (même vides)

Compositions (total=12, 10 types). Mêmes éléments, même structure.
Compositions variées avec tous les 10 types. Compositions adaptées des actuels niv 13.

### Niveau 14 : accélération — 12 cases, 8 vides, 4 fixés (+1 vide)

Compositions (total=12, 10 types). +1 vide vs niv 13.
Compositions adaptées des actuels niv 14.

### Niveau 15 : expert — 12 cases, 8 vides, 4 fixés (bonus désactivés)

Compositions identiques au niv 14. La difficulté vient de l'absence totale de bonus.

**Plafond à 8 vides / 12 cases** confirmé. Les niveaux 16+ (grilles 13-14 cases) permettront d'aller au-delà, hors scope actuel.

---

## Risques identifiés

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Le solver ne trouve pas de solution unique avec la nouvelle contrainte ruche (ours cluster) sur certaines compositions | Moyenne | Tester avec le solver avant de valider les compositions. Limiter ours ≤ 3 quand ruche=1. |
| **Niveaux 14-15 (8 vides / 12 cases, 4 fixés) : génération lente** | Faible | 8 vides / 12 cases = raisonnable. L'actuel niv 14 a déjà 8 vides et fonctionne. Les 10 types d'éléments + contraintes multiples élaguent efficacement. |
| **Défis trop faciles malgré les ajustements** | Moyenne | Les vides proposés (+1 à +3 vs actuel) sont significatifs mais conservateurs. Si les joueurs finissent encore trop vite, augmenter de +1 vide par niveau lors d'un futur ajustement. |
| `availableElements` dans les boards filtre les compositions | À vérifier | Inspecter le code du generator pour voir si ce champ est utilisé. Mettre à jour si oui. |
| Migration joueurs existants — les challengeIds changent de contenu | Faible | Les IDs sont format `niveau_X_Y`. 10 défis par niveau = pas de changement de count. Le contenu change mais la progression stockée reste valide. |
| Les compositions sans ruche (niv 1-6) produisent trop peu de diversité | Faible | 3-5 types avec repulsion + meute + antagonisme + topologie asymétrique = diversité suffisante. |
| **Niv 12-13 (7 vides, 5 fixés) ressentis comme trop faciles après niv 10-11 (8 vides, 3 fixés)** | Moyenne | La respiration est volontaire. Le saut cognitif (12 cases, 10 types, chaîne complète) compense les 5 fixés. Si c'est trop facile, réduire à 4 fixés (8 vides) dans un futur patch. |

---

## Hors scope

- Ajout de niveaux 16-18 (nouveaux plateaux)
- Mode Expert / New Game+
- Ajout de nouveaux éléments
- Modification de l'onglet Profil ou du système d'authentification
- Modification du système de badges ou de bonus

## Validation empirique requise avant finalisation

Étapes de test à exécuter **pendant l'implémentation** pour valider la faisabilité :

1. **Test solver niv 14-15** : Générer 10 défis avec 8 vides / 12 cases / 10 types. Mesurer le temps. Devrait être rapide (l'actuel niv 14 a déjà 8 vides).
2. **Test contrainte ruche/ours** : Générer 50 défis avec ruche=1 + ours=3 sur board_10_v3. Vérifier unicité et temps raisonnable.
3. **Test jouabilité niv 4** : 5 vides / 8 cases avec chien. Résoudre manuellement 3-5 défis. Vérifier challenge sans frustration.
4. **Test jouabilité niv 6** : 6 vides / 9 cases, 5 types, 3 fixés. Vérifier que c'est un bon cran au-dessus du niv 5.
5. **Test paliers de respiration** : Vérifier les transitions de plateau (niv 2→3, 4→5, 6→7, 8→9, 10→12). Le passage de 4→3 fixés (accélération) puis retour à 4 fixés (nouveau board) doit se sentir naturel.
6. **Test respiration niv 12** : 7 vides / 12 cases / 5 fixés / 10 types. Vérifier que la baisse de vides (8→7) est compensée par la complexité du board + chaîne complète.
