# Plan — Cartes à Collectionner ONF (Herbier de la Forêt)

**Date :** 2026-10-16  
**Objectif :** Ajouter un système de cartes à collectionner (essences d'arbres) dans le mode ONF, gagnées tous les 5 défis réussis.

---

## Décision : Ordre fixe vs. aléatoire

**Choix retenu : ordre fixe, identique pour tous les joueurs.**

Justification :
- `treesData.js` a déjà un `id` séquentiel couplé à `challenge_id` — la structure est conçue pour un ordre linéaire
- Formule simple et sans état supplémentaire : la N-ième carte débloquée = `TREES_DATA[N - 1]` (0-indexé)
- Permet la comparaison sociale ("j'ai 6 cartes, et toi ?", "tu as le Ginkgo ?)
- L'aléatoire nécessiterait de stocker "quelle carte a été assignée à quel palier" dans Firestore, complexifiant le schéma et le risque de doublon
- Cohérence pédagogique : un herbier ordonné = un vrai album Panini

---

## Vue d'ensemble des changements

```
Étapes :
  1. Données et constantes
  2. Modèle Firestore + playerStore
  3. Composant carte retournable TreeCard
  4. Modal galerie (Voir toutes les cartes)
  5. Bouton ONF sur index.tsx — affichage compteur + cartes
  6. Page intermédiaire ONFLobby (écran avant de jouer)
  7. VictoryModal ONF — jauge + déclenchement carte
  8. Modal découverte carte (avec effet wahou)
  9. Sync Firestore
 10. i18n (fr + en)
 11. Tests et vérifications
```

---

## 1. Données et constantes

### 1.1 Source de vérité des arbres

`scripts/treesData.js` contient déjà 90+ arbres avec :
- `id` (int, séquentiel 1..N)
- `name_fr`, `name_latin`, `region`, `geo_location`, `anecdote`
- `onf_image_url` (fruit/feuille) et `wikimedia_image_url` (photo arbre entier)
- `image_type` : `"fruit"` | `"feuille"`

**Action :** Créer `src/data/treesData.ts` — copie TypeScript du fichier JS pour usage dans l'app React Native. Pas d'import dynamique du fichier scripts/.

```ts
// src/data/treesData.ts
export interface TreeCard {
  id: number;           // 1-indexé, détermine l'ordre de distribution
  name_fr: string;
  name_latin: string;
  region: string;
  geo_location: string;
  anecdote: string;
  onf_image_url: string;    // recto : image fruit/feuille
  wikimedia_image_url: string; // verso : photo arbre entier
  image_type: 'fruit' | 'feuille' | 'photo';
}

export const TREES_DATA: TreeCard[] = [ /* ... même contenu que treesData.js ... */ ];
```

### 1.2 Constante palier

```ts
// src/constants/onf.ts (ajout)
/** Nb de défis ONF à réussir pour débloquer 1 nouvelle carte */
export const ONF_CARD_UNLOCK_EVERY = 5;
```

### 1.3 Helper de calcul

```ts
// src/utils/onfCards.ts
import { TREES_DATA, TreeCard } from '../data/treesData';
import { ONF_CARD_UNLOCK_EVERY } from '../constants/onf';

/** Retourne le nombre de cartes débloquées en fonction du nombre de défis réussis */
export function getUnlockedCardCount(onfSolvedCount: number): number {
  return Math.floor(onfSolvedCount / ONF_CARD_UNLOCK_EVERY);
}

/** Retourne les TreeCard débloquées (ordre fixe, 0-indexé sur TREES_DATA) */
export function getUnlockedCards(onfSolvedCount: number): TreeCard[] {
  const count = getUnlockedCardCount(onfSolvedCount);
  return TREES_DATA.slice(0, count);
}

/** Retourne la prochaine carte à débloquer (pour preview verrouillée) */
export function getNextCard(onfSolvedCount: number): TreeCard | null {
  const nextIndex = getUnlockedCardCount(onfSolvedCount);
  return TREES_DATA[nextIndex] ?? null;
}

/** Retourne la carte qui vient d'être débloquée (après une victoire qui franchit un palier) */
export function getJustUnlockedCard(previousCount: number, newCount: number): TreeCard | null {
  const prevCards = getUnlockedCardCount(previousCount);
  const newCards  = getUnlockedCardCount(newCount);
  if (newCards > prevCards) {
    return TREES_DATA[newCards - 1] ?? null;
  }
  return null;
}

/** Progression dans le palier courant : { current, total } */
export function getCardProgress(onfSolvedCount: number): { current: number; total: number } {
  return {
    current: onfSolvedCount % ONF_CARD_UNLOCK_EVERY,
    total: ONF_CARD_UNLOCK_EVERY,
  };
}
```

---

## 2. Modèle Firestore + playerStore

### 2.1 PlayerProfile (playerService.ts)

Ajouter dans l'interface `PlayerProfile` :

```ts
// Cartes à collectionner ONF
collectedTreeCardIds: number[];   // IDs des cartes débloquées (ordre d'obtention)
```

Ajouter dans `migrateProfile()` :
```ts
collectedTreeCardIds: raw.collectedTreeCardIds ?? [],
```

### 2.2 PlayerState + actions (playerStore.ts)

Ajouter dans `PlayerState` :
```ts
collectedTreeCardIds: number[];  // IDs des cartes débloquées
```

Valeur initiale :
```ts
collectedTreeCardIds: [],
```

Ajouter action `collectTreeCard(cardId: number)` :
```ts
collectTreeCard: (cardId) => set(state => ({
  collectedTreeCardIds: state.collectedTreeCardIds.includes(cardId)
    ? state.collectedTreeCardIds
    : [...state.collectedTreeCardIds, cardId],
})),
```

Mettre à jour `restoreFromCloud()` pour inclure `collectedTreeCardIds`.

**Note :** On stocke les IDs, pas les objets complets — les données des arbres restent dans `TREES_DATA` côté client. L'ID suffit pour retrouver la carte.

### 2.3 Sync Firestore

Dans `src/services/playerService.ts`, ajouter `collectedTreeCardIds` dans :
- `upsertPlayer()` (création initiale)
- `updateCollectedCards(userId, cardIds)` — nouvelle fonction pour mise à jour ciblée

Appel depuis la logique de victoire ONF (`app/game/onf.tsx`) :
```ts
// Après incrementOnfSolved(), si une nouvelle carte est débloquée :
await updateCollectedCards(userId, [...existingIds, newCardId]);
```

---

## 3. Composant TreeCardView (carte retournable)

### Fichier : `src/components/ONF/TreeCardView.tsx`

Carte retournable avec effet 3D, inspiré de `viewer.html` mais embelli.

#### Design amélioré (vs viewer.html tout blanc)

**Recto :**
- Fond dégradé vertical : vert forêt sombre → vert moyen (`#1B5E20` → `#2E7D32`) — comme l'ambiance du jeu
- Numéro de carte `#N` en badge doré (fond `#FFD700`, texte `#1B5E20`)
- Badge type image : `🍂 Fruit` (orange) | `🍃 Feuille` (vert clair)
- Image fruit/feuille dans un cadre arrondi avec bordure crème (`#F5F0E8`) et légère ombre
- Nom français en grand, texte blanc avec ombre douce
- Filigrane ONF en bas (petit, semi-transparent)
- Bordure générale : 2px or `#C9A84C` — aspect "objet précieux"
- Coins décorés : petites feuilles SVG aux 4 coins (optionnel, phase 2)

**Verso :**
- Fond crème/parchemin (`#FDF6E3`) — contraste avec recto foncé, ambiance vieux livre
- Photo Wikimedia de l'arbre entier (hauteur ~170px, object-fit cover, coins arrondis)
- Nom latin en italique gras, couleur vert foncé
- Icône 📍 + texte géolocalisation (gris ardoise)
- Bloc anecdote : fond vert très clair `#E8F5E9`, texte vert foncé, icône 💡
- Footer : `🌲 ONF — Agir pour la forêt` + `© Wikimedia Commons`
- Bordure : 2px `#8D6E63` (brun-bois)

#### Props du composant

```ts
interface TreeCardViewProps {
  tree: TreeCard;
  initialFlipped?: boolean;    // démarrer verso (pour la modal découverte)
  showFlipHint?: boolean;      // afficher "Toucher pour retourner"
  size?: 'normal' | 'mini';   // 'mini' pour la galerie
}
```

#### Animation de retournement

Utiliser `react-native-reanimated` (déjà en dépendance) + `useSharedValue` + `withTiming` :

```ts
// Rotation 3D sur l'axe Y avec interpolateColor pour les faces
const rotateY = useSharedValue(0);

const frontStyle = useAnimatedStyle(() => ({
  transform: [{ rotateY: `${rotateY.value}deg` }],
  backfaceVisibility: 'hidden',
}));

const backStyle = useAnimatedStyle(() => ({
  transform: [{ rotateY: `${rotateY.value + 180}deg` }],
  backfaceVisibility: 'hidden',
}));

const handleFlip = () => {
  rotateY.value = withTiming(isFlipped ? 0 : 180, { duration: 600 });
  setIsFlipped(!isFlipped);
};
```

**Alternative si problème backfaceVisibility sur certains OS :** interpoler `opacity` (0 → 1 à mi-course) + `scaleX` (-1 → 1) — technique plus compatible cross-platform.

---

## 4. Modal galerie : TreeCardGallery

### Fichier : `src/components/ONF/TreeCardGallery.tsx`

Modal plein écran affichant toutes les cartes débloquées (et une preview verrouillée de la prochaine).

#### Layout

- Header : titre "Herbier de la Forêt 🌲" + bouton fermer (×)
- Sous-titre : "X cartes / Y au total" (ex: "6 cartes / 90 au total")
- ScrollView horizontal ou grille 2 colonnes avec cartes en mode `mini`
  - Option A : carrousel horizontal (une carte visible à la fois, swipe)
  - **Option B (recommandée) : grille 2 colonnes**, clic sur une carte → ouvre une modal détail avec la carte en grand (retournable)
- Dernière cellule : carte verrouillée (sihouette + "Encore X défis pour débloquer")
- Animation d'entrée : FadeIn + SlideUp (Reanimated)

#### État interne

```ts
const [selectedCard, setSelectedCard] = useState<TreeCard | null>(null);
// Modal détail : TreeCardView en plein écran + bouton fermer
```

#### Usage

Ce composant est appelé depuis :
1. Bouton "Voir toutes les Cartes gagnées" sur `ONFLobbyScreen`
2. Bouton "Découvrir" dans `VictoryModal` (après débloquage d'une carte)
   - Dans ce cas, `initialCard` prop force l'ouverture sur la nouvelle carte

```ts
interface TreeCardGalleryProps {
  visible: boolean;
  onClose: () => void;
  collectedCardIds: number[];
  initialCardId?: number;   // scroll/focus sur cette carte à l'ouverture
}
```

---

## 5. Bouton ONF sur index.tsx

### Fichier : `app/(tabs)/index.tsx` (modification)

La carte ONF déverrouillée affiche :

**État initial (0 défis résolus) :**
```
🌲 Grille Forestière
"Gagnez votre 1er défi !"
```

**Après au moins 1 défi :**
```
🌲 Grille Forestière
"X défis résolus · Y cartes 🍃"
```

Exemples :
- 3 défis, 0 cartes → `"3 défis résolus · 0 carte 🍃"`
- 5 défis, 1 carte → `"5 défis résolus · 1 carte 🍃"`
- 12 défis, 2 cartes → `"12 défis résolus · 2 cartes 🍃"`

Les valeurs sont lues depuis `usePlayerStore(s => s.onfSolvedCount)` et `getUnlockedCardCount(onfSolvedCount)`.

---

## 6. Page intermédiaire ONFLobby

### Fichier : `app/game/onf-lobby.tsx` (nouveau fichier)

Écran intermédiaire analogue au briefing des défis solo.

#### Layout

```
┌─────────────────────────────────┐
│  🌲 Grille Forestière           │
│  Mode ONF                       │
│                                 │
│  ╔═════════════════════════════╗│
│  ║  X défis résolus             ║│
│  ╠═════════════════════════════╣│
│  ║  Progression vers la carte  ║│
│  ║  [████████░░░░░░] X/5       ║│
│  ║  "Encore Y défi(s) pour     ║│
│  ║   débloquer une carte 🍃"   ║│
│  ╚═════════════════════════════╝│
│                                 │
│  ┌──────────────────────────┐   │
│  │  Aperçu de la prochaine  │   │
│  │  carte à débloquer       │   │
│  │  [Card recto, verrouillé]│   │
│  │  🔒 Nom caché            │   │
│  └──────────────────────────┘   │
│                                 │
│  [ 🌲  Jouer  ]                 │
│                                 │
│  [ Voir toutes mes cartes 🍃 ]  │
│                                 │
└─────────────────────────────────┘
```

#### Détails

- `onfSolvedCount` = valeur actuelle depuis `playerStore`
- Progress bar : `(onfSolvedCount % 5) / 5` — animée à l'entrée (Reanimated `withTiming`)
- Aperçu carte verrouillée : `TreeCardView` avec `locked=true` → fond flouté ou silhouette sombre + icône 🔒
- Si toutes les cartes sont débloquées (onfSolvedCount >= TREES_DATA.length * 5) : afficher message "Collection complète !" + badge spécial
- Bouton "Jouer" → `router.push('/game/onf?size=3')` (ou 4 si débloqué)
- Bouton "Voir toutes mes cartes" → ouvre `TreeCardGallery`

#### Navigation

L'entrée dans le mode ONF passe par ce lobby :
- `app/(tabs)/index.tsx` → bouton ONF → `router.push('/game/onf-lobby')` (au lieu de `/game/onf` directement)
- `app/(tabs)/levels.tsx` → même chose si bouton ONF présent

---

## 7. VictoryModal ONF — jauge et déclenchement carte

### Fichier : `app/game/onf.tsx` (modification)

Après victoire, dans la `VictoryModal` (ou composant dédié `ONFVictoryModal`) :

#### Section jauge (toujours visible)

```
┌─────────────────────────────────┐
│  🎉  Défi réussi !              │
│                                 │
│  +X 🌱  ·  Temps : MM:SS       │
│                                 │
│  ── Herbier de la Forêt ──      │
│  [████████████░░░░] X/5        │
│  "Encore Y défi(s) pour        │
│   débloquer une carte"         │
│                                 │
│  [ Rejouer ]  [ Retour ]        │
└─────────────────────────────────┘
```

#### Déclenchement carte (quand palier atteint)

Quand `newCount % 5 === 0` (nouvelle carte débloquée), afficher un pavé supplémentaire **dans la VictoryModal** avec effet wahou :

```
┌─────────────────────────────────┐
│  🎉  Défi réussi !              │
│                                 │
│  +X 🌱  ·  Temps : MM:SS       │
│                                 │
│  ╔═════════════════════════════╗│ ← apparaît avec animation
│  ║  🎊  1 carte débloquée !    ║│
│  ║  ────────────────────────   ║│
│  ║  [Image recto de la carte]  ║│ ← TreeCardView mini, non retournable
│  ║  Nom de l'arbre             ║│
│  ║                             ║│
│  ║  [ Découvrir  🍃 ]          ║│ ← ouvre TreeCardGallery sur cette carte
│  ╚═════════════════════════════╝│
│                                 │
│  ── Herbier de la Forêt ──      │
│  [████████████████] 5/5 ✓      │
│                                 │
│  [ Rejouer ]  [ Retour ]        │
└─────────────────────────────────┘
```

#### Effets visuels "wahou"

Le pavé de carte débloquée s'anime à l'entrée :

1. **Confettis** : réutiliser `src/components/Game/Confetti.tsx` déjà existant — déclencher au moment de l'apparition du pavé
2. **Feu d'artifice** : ajouter `FireworkEffect.tsx` — particules colorées qui s'épanouissent depuis le centre du pavé (Reanimated Animated.View + positions calculées en polar coordinates)
3. **Scale bounce** : le pavé entre en `scale: 0 → 1.1 → 1.0` avec `withSpring` + delay de 300ms après l'apparition de la VictoryModal
4. **Shimmer/brillance** : bordure animée avec gradient tournant (optionnel — phase 2)

#### Implémentation technique

Dans `onf.tsx`, après `player.incrementOnfSolved()` :

```ts
const previousCount = player.onfSolvedCount; // avant increment
await player.incrementOnfSolved();
const newCount = player.onfSolvedCount; // après increment

const justUnlocked = getJustUnlockedCard(previousCount, newCount);
if (justUnlocked) {
  // 1. Enregistrer dans le store
  player.collectTreeCard(justUnlocked.id);
  // 2. Sync Firestore
  await updateCollectedCards(userId, player.collectedTreeCardIds);
  // 3. Déclencher l'UI wahou (setState local)
  setJustUnlockedCard(justUnlocked);
}
```

**Attention à la race condition** : `onfSolvedCount` dans Zustand est mis à jour par `incrementOnfSolved()`. Lire la valeur AVANT et APRÈS pour calculer si un palier a été franchi. Utiliser `usePlayerStore.getState()` pour la valeur post-update.

---

## 8. Modal découverte carte

Quand l'utilisateur appuie sur "Découvrir 🍃" dans la VictoryModal :

Ouvrir `TreeCardGallery` avec `initialCardId = justUnlocked.id` → la galerie scrolle/focus sur cette carte et la montre en grand, déjà retournée côté recto, avec le hint "Toucher pour retourner".

Option alternative : ouvrir directement une modal `TreeCardDetailModal` (plus simple) avec juste la carte en grand + bouton "Voir toute la collection" → galerie complète.

**Choix : modal détail directe** (meilleure expérience wahou, évite de noyer la nouvelle carte dans la galerie).

---

## 9. Sync Firestore

### Champs à synchroniser

Dans `PlayerProfile` (Firestore) :
```
collectedTreeCardIds: number[]   // ex: [1, 2, 5, 7]
```

### playerService.ts — nouvelle fonction

```ts
export async function updateCollectedCards(userId: string, cardIds: number[]): Promise<void> {
  const ref = doc(db, 'players', userId);
  await updateDoc(ref, { collectedTreeCardIds: cardIds, updatedAt: serverTimestamp() });
}
```

### migrateProfile()

```ts
collectedTreeCardIds: raw.collectedTreeCardIds ?? [],
```

### restoreFromCloud()

Dans `playerStore.ts`, `restoreFromCloud()` effectue une union intelligente :
```ts
// Ne jamais réduire la collection locale si elle est plus grande que le cloud
const mergedCardIds = Array.from(new Set([
  ...(state.collectedTreeCardIds ?? []),
  ...(profile.collectedTreeCardIds ?? []),
])).sort((a, b) => a - b);
```

---

## 10. i18n

### Clés à ajouter dans `fr.json` et `en.json`

```json
// fr.json
{
  "onf_lobby_title": "Grille Forestière",
  "onf_lobby_solved_count": "{{count}} défi réussi",
  "onf_lobby_solved_count_plural": "{{count}} défis réussis",
  "onf_lobby_progress": "{{current}}/{{total}} avant une nouvelle carte",
  "onf_lobby_next_card": "Encore {{remaining}} défi pour débloquer une carte",
  "onf_lobby_next_card_plural": "Encore {{remaining}} défis pour débloquer une carte",
  "onf_lobby_play": "Jouer",
  "onf_lobby_see_cards": "Voir toutes mes cartes 🍃",
  "onf_lobby_collection_complete": "Collection complète ! 🏆",
  "onf_btn_first_win": "Gagnez votre 1er défi !",
  "onf_btn_stats": "{{count}} défis résolus · {{cards}} carte",
  "onf_btn_stats_plural": "{{count}} défis résolus · {{cards}} cartes",
  "onf_card_unlocked_title": "1 carte débloquée !",
  "onf_card_discover": "Découvrir 🍃",
  "gallery_title": "Herbier de la Forêt",
  "gallery_subtitle": "{{owned}} cartes / {{total}} au total",
  "gallery_locked_card": "Encore {{count}} défi pour débloquer",
  "gallery_locked_card_plural": "Encore {{count}} défis pour débloquer",
  "gallery_empty": "Résolvez votre premier défi ONF pour obtenir votre 1re carte !",
  "card_flip_hint": "Toucher pour retourner",
  "card_image_type_fruit": "🍂 Fruit",
  "card_image_type_feuille": "🍃 Feuille",
  "card_onf_credit": "🌲 ONF — Agir pour la forêt",
  "card_wikimedia_credit": "© Wikimedia Commons"
}
```

```json
// en.json
{
  "onf_lobby_title": "Forest Grid",
  "onf_lobby_solved_count": "{{count}} challenge won",
  "onf_lobby_solved_count_plural": "{{count}} challenges won",
  "onf_lobby_progress": "{{current}}/{{total}} before a new card",
  "onf_lobby_next_card": "{{remaining}} more challenge to unlock a card",
  "onf_lobby_next_card_plural": "{{remaining}} more challenges to unlock a card",
  "onf_lobby_play": "Play",
  "onf_lobby_see_cards": "See all my cards 🍃",
  "onf_lobby_collection_complete": "Complete collection! 🏆",
  "onf_btn_first_win": "Win your 1st challenge!",
  "onf_btn_stats": "{{count}} challenges won · {{cards}} card",
  "onf_btn_stats_plural": "{{count}} challenges won · {{cards}} cards",
  "onf_card_unlocked_title": "1 card unlocked!",
  "onf_card_discover": "Discover 🍃",
  "gallery_title": "Forest Herbarium",
  "gallery_subtitle": "{{owned}} cards / {{total}} total",
  "gallery_locked_card": "{{count}} more challenge to unlock",
  "gallery_locked_card_plural": "{{count}} more challenges to unlock",
  "gallery_empty": "Solve your first ONF challenge to get your 1st card!",
  "card_flip_hint": "Tap to flip",
  "card_image_type_fruit": "🍂 Fruit",
  "card_image_type_feuille": "🍃 Leaf",
  "card_onf_credit": "🌲 ONF — Acting for forests",
  "card_wikimedia_credit": "© Wikimedia Commons"
}
```

---

## 11. Arborescence des nouveaux fichiers

```
src/
  data/
    treesData.ts                   ← NEW — données TypeScript des arbres (copie de treesData.js)
  utils/
    onfCards.ts                    ← NEW — helpers getUnlockedCards, getJustUnlockedCard, getCardProgress
  components/
    ONF/
      TreeCardView.tsx             ← NEW — composant carte retournable (recto/verso animé)
      TreeCardGallery.tsx          ← NEW — modal galerie / collection complète
      ONFCardUnlockBanner.tsx      ← NEW — pavé "1 carte débloquée" avec effets wahou dans VictoryModal
      FireworkEffect.tsx           ← NEW — particules feu d'artifice (Reanimated)
app/
  game/
    onf-lobby.tsx                  ← NEW — page intermédiaire avant de jouer ONF
```

**Fichiers modifiés :**
```
src/constants/onf.ts               ← + ONF_CARD_UNLOCK_EVERY = 5
src/data/treesData.ts              ← nouveau fichier TypeScript
src/store/playerStore.ts           ← + collectedTreeCardIds, + collectTreeCard()
src/services/playerService.ts      ← + collectedTreeCardIds dans PlayerProfile + updateCollectedCards()
app/(tabs)/index.tsx               ← bouton ONF : nouvelle string stats + navigation vers onf-lobby
app/game/onf.tsx                   ← logique déclenchement carte après victoire + ONFCardUnlockBanner
src/i18n/locales/fr.json           ← nouvelles clés
src/i18n/locales/en.json           ← nouvelles clés
```

---

## 12. Points d'attention / risques

### Images Wikimedia Commons (URLs distantes)
- Les URLs `wikimedia_image_url` et `onf_image_url` pointent vers Wikimedia Commons
- Sur React Native, les images distantes nécessitent un `<Image source={{ uri: '...' }}>`
- Gérer les erreurs de chargement avec un fallback (emoji 🌳 ou fond coloré)
- Expo SDK 57 : pas de cache d'image natif automatique — envisager `expo-image` (plus performant que `<Image>` de React Native) si les performances sont insuffisantes

### Performance de la galerie
- 90 cartes avec images distantes = potential lag
- Utiliser `FlatList` avec `keyExtractor`, `removeClippedSubviews`, `windowSize` limité
- Ne charger les images que des cartes visibles (lazy loading natif de `FlatList`)

### Rétrocompatibilité Firestore
- `collectedTreeCardIds` absent des profils existants → `migrateProfile()` retourne `[]` par défaut ✓
- Pas de migration Firestore forcée nécessaire

### Race condition incrementOnfSolved
- `incrementOnfSolved()` fait un `set()` Zustand synchrone
- Pour lire la valeur post-update, utiliser `usePlayerStore.getState().onfSolvedCount` immédiatement après
- Ne pas lire depuis le hook `usePlayerStore()` dans un `useEffect` car la valeur peut ne pas être encore reflétée

### Android backfaceVisibility
- `backfaceVisibility: 'hidden'` est parfois buggé sur Android avec Reanimated
- Solution de repli : technique opacity-based (opacité 0 ↔ 1 à mi-parcours de l'animation) — plus fiable cross-platform

### Expo Router v57 — nouveau fichier de route
- `app/game/onf-lobby.tsx` crée automatiquement la route `/game/onf-lobby`
- Pas de configuration supplémentaire nécessaire avec l'Expo Router file-based

---

## 13. Ordre d'implémentation recommandé

L'ordre minimise les dépendances et permet de tester chaque étape indépendamment :

1. `src/data/treesData.ts` — copie des données (pas de dépendance)
2. `src/utils/onfCards.ts` — helpers purs (dépend de 1)
3. `src/constants/onf.ts` — ajout constante (pas de dépendance)
4. `src/store/playerStore.ts` + `playerService.ts` — modèle (dépend de 3)
5. `src/components/ONF/TreeCardView.tsx` — carte retournable (dépend de 1)
6. `src/components/ONF/TreeCardGallery.tsx` — galerie (dépend de 5)
7. `app/game/onf-lobby.tsx` — page lobby (dépend de 2, 4, 5, 6)
8. `app/(tabs)/index.tsx` — mise à jour bouton (dépend de 2, 4)
9. `src/components/ONF/FireworkEffect.tsx` + `ONFCardUnlockBanner.tsx` (dépend de 5)
10. `app/game/onf.tsx` — logique victoire + intégration banner (dépend de 2, 4, 9)
11. i18n — clés fr.json + en.json

---

## 14. Questions ouvertes (décisions différées)

| Question | Options | Note |
|---|---|---|
| Galerie : grille ou carrousel ? | Grille 2 col (recommandé) / carrousel horizontal | La grille permet de voir plusieurs cartes d'un coup |
| Aperçu carte verrouillée dans lobby | Silhouette sombre / "?" avec fond flou / contour sans image | Silhouette recommandée pour l'effet mystère |
| Nombre max de cartes dans TREES_DATA | 90 arbres déjà définis | Collection complète = 450 défis ONF — suffisant pour long terme |
| Expo Image vs Image RN | expo-image (meilleur cache) / Image RN (plus simple) | Recommandé : expo-image si déjà installé sinon Image RN |
| Badges liés aux cartes | 1 badge "Première carte", 1 "10 cartes", 1 "Collection complète" | Phase 2 — hors scope de ce plan |
