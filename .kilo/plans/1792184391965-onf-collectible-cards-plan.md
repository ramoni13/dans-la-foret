# Plan — Cartes à collectionner ONF (Herbier de la Forêt)

**Date :** 2026-10-16

---

## Décisions arrêtées

| Sujet | Décision |
|---|---|
| Nombre de cartes | 100 (essences id 1→100 de treesData.js) |
| Palier | 1 carte tous les 5 défis ONF réussis |
| Ordre | Fixe et identique pour tous : carte N = `TREES_DATA[N-1]` |
| Image | 1 image embarquée par carte dans `assets/trees/tree_001.jpg`…`tree_100.jpg` |
| Source image | `onf_image_url` (fruit en priorité, feuille sinon) — fallback `wikimedia_image_url` |
| Poids estimé | ~10 Mo (100 × 100 Ko) |
| Recto | Image pleine + nom français en dessous |
| Verso | Nom courant · Nom latin · Lieu · Anecdote + "ONF – Agir pour la forêt" + N° carte |
| Stockage ids | `collectedTreeCardIds: number[]` dans playerStore + Firestore |
| Pas d'expo-image | Utiliser `<Image>` React Native avec fallback emoji |

---

## Travail éditorial préalable (hors code)

> À faire AVANT d'implémenter : préparer les 100 images embarquées.

1. Pour chaque essence id 1→100 dans `treesData.js` :
   - Télécharger l'URL `onf_image_url` (fruit/cône/feuille)
   - Si absente ou inutilisable → `wikimedia_image_url`
2. Redimensionner à **400×400 px** et compresser en JPEG qualité ~75 → cible ≤ 100 Ko
3. Nommer `tree_001.jpg`, `tree_002.jpg` … `tree_100.jpg` (zéro-padded 3 chiffres)
4. Déposer dans `assets/trees/`
5. Outil suggéré : [squoosh.app](https://squoosh.app) en batch, ou `sharp` en CLI

---

## Arborescence des fichiers

### Nouveaux fichiers
```
assets/trees/
  tree_001.jpg … tree_100.jpg       ← images embarquées (travail éditorial)

src/
  data/
    treesData.ts                    ← 100 premières essences, type TreeCard
  utils/
    onfCards.ts                     ← helpers purs (calcul cartes, progression)
  components/
    ONF/
      TreeCardView.tsx              ← carte retournable (recto/verso animée)
      TreeCardGallery.tsx           ← modal galerie collection complète
      ONFCardUnlockBanner.tsx       ← pavé "carte débloquée" dans VictoryModal

app/
  game/
    onf-lobby.tsx                   ← page intermédiaire avant de jouer ONF
```

### Fichiers modifiés
```
src/constants/onf.ts
src/store/playerStore.ts
src/services/playerService.ts
app/(tabs)/index.tsx
app/game/onf.tsx
src/i18n/locales/fr.json
src/i18n/locales/en.json
```

---

## Tâches dans l'ordre d'implémentation

### 1. `src/data/treesData.ts`

Copie TypeScript des 100 premières entrées de `scripts/treesData.js`.

```ts
export interface TreeCard {
  id: number;              // 1-indexé
  name_fr: string;
  name_latin: string;
  geo_location: string;
  anecdote: string;
  image_type: 'fruit' | 'feuille' | 'photo';
}

// images embarquées via require() — map statique obligatoire avec Metro
export const TREE_IMAGES: Record<number, any> = {
  1:  require('../../assets/trees/tree_001.jpg'),
  2:  require('../../assets/trees/tree_002.jpg'),
  // … jusqu'à 100
};

export const TREES_DATA: TreeCard[] = [
  { id: 1,  name_fr: 'Chêne pédonculé', name_latin: 'Quercus robur', ... },
  // … 100 entrées (copier depuis treesData.js, retirer les champs URL)
];
```

> **Important Metro/Expo :** les `require()` d'images doivent être statiques (pas de template string dynamique). La map `TREE_IMAGES` est donc obligatoire — on ne peut pas faire `require(\`tree_${id}.jpg\`)`.

---

### 2. `src/utils/onfCards.ts`

```ts
import { TREES_DATA, TreeCard } from '../data/treesData';
import { ONF_CARD_UNLOCK_EVERY } from '../constants/onf';

export function getUnlockedCardCount(onfSolvedCount: number): number {
  return Math.min(TREES_DATA.length, Math.floor(onfSolvedCount / ONF_CARD_UNLOCK_EVERY));
}

export function getUnlockedCards(onfSolvedCount: number): TreeCard[] {
  return TREES_DATA.slice(0, getUnlockedCardCount(onfSolvedCount));
}

export function getNextCard(onfSolvedCount: number): TreeCard | null {
  return TREES_DATA[getUnlockedCardCount(onfSolvedCount)] ?? null;
}

/** Retourne la carte nouvellement débloquée si un palier vient d'être franchi */
export function getJustUnlockedCard(countBefore: number, countAfter: number): TreeCard | null {
  const cardsBefore = getUnlockedCardCount(countBefore);
  const cardsAfter  = getUnlockedCardCount(countAfter);
  if (cardsAfter > cardsBefore) return TREES_DATA[cardsAfter - 1] ?? null;
  return null;
}

/** { current: défis depuis dernier palier, total: 5 } */
export function getCardProgress(onfSolvedCount: number): { current: number; total: number } {
  return { current: onfSolvedCount % ONF_CARD_UNLOCK_EVERY, total: ONF_CARD_UNLOCK_EVERY };
}
```

---

### 3. `src/constants/onf.ts` — ajout

```ts
export const ONF_CARD_UNLOCK_EVERY = 5;
```

---

### 4. `src/store/playerStore.ts` — ajouts

**Dans `PlayerState` :**
```ts
collectedTreeCardIds: number[];
```

**Valeur initiale :**
```ts
collectedTreeCardIds: [],
```

**Action :**
```ts
collectTreeCard: (cardId: number) => set(state => ({
  collectedTreeCardIds: state.collectedTreeCardIds.includes(cardId)
    ? state.collectedTreeCardIds
    : [...state.collectedTreeCardIds, cardId],
})),
```

**Dans `restoreFromCloud()` :** union sans doublon, triée :
```ts
collectedTreeCardIds: Array.from(new Set([
  ...(state.collectedTreeCardIds ?? []),
  ...(profile.collectedTreeCardIds ?? []),
])).sort((a, b) => a - b),
```

---

### 5. `src/services/playerService.ts` — ajouts

**Dans `PlayerProfile` :**
```ts
collectedTreeCardIds: number[];
```

**Dans `migrateProfile()` :**
```ts
collectedTreeCardIds: raw.collectedTreeCardIds ?? [],
```

**Nouvelle fonction :**
```ts
export async function updateCollectedCards(userId: string, cardIds: number[]): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    collectedTreeCardIds: cardIds,
    updatedAt: serverTimestamp(),
  });
}
```

**Dans `upsertPlayer()` :** inclure `collectedTreeCardIds` dans le document créé.

---

### 6. `src/components/ONF/TreeCardView.tsx`

Carte retournable animée avec Reanimated.

#### Props
```ts
interface TreeCardViewProps {
  tree: TreeCard;
  size?: 'normal' | 'mini';   // normal: 300×480, mini: 150×240
  startFlipped?: boolean;     // pour la modal découverte
  locked?: boolean;           // affiche silhouette + 🔒
}
```

#### Dimensions
- Normal : `width: 300, height: 480`
- Mini : `width: 150, height: 240` (galerie grille 2 colonnes)

#### Animation retournement
Utiliser technique **opacity + scaleX** (plus fiable cross-platform que `backfaceVisibility` sur Android) :

```ts
const progress = useSharedValue(startFlipped ? 1 : 0); // 0=recto, 1=verso

// Recto : visible de 0 à 0.5, verso : visible de 0.5 à 1
const frontOpacity = useAnimatedStyle(() => ({
  opacity: progress.value < 0.5 ? 1 : 0,
  transform: [{ scaleX: progress.value < 0.5 ? 1 - progress.value * 2 : 0 }],
}));
const backOpacity = useAnimatedStyle(() => ({
  opacity: progress.value >= 0.5 ? 1 : 0,
  transform: [{ scaleX: progress.value >= 0.5 ? (progress.value - 0.5) * 2 : 0 }],
}));

const flip = () => {
  const target = progress.value < 0.5 ? 1 : 0;
  progress.value = withTiming(target, { duration: 500 });
};
```

#### Design Recto
- Fond : dégradé vertical `#1A3C1A` → `#2D6A2D` (vert forêt profond)
- Bordure : 2px `#C9A84C` (or), `borderRadius: 16`
- Image fruit/feuille : pleine largeur, hauteur ~65% de la carte, `resizeMode: 'cover'`, coins arrondis haut
- Fallback si image absente : fond `#2D5A2D` + emoji 🌳 centré (fontSize selon taille)
- Nom français : texte blanc, `fontSize: 18` (normal) / `9` (mini), `fontWeight: '700'`, centré, paddingHorizontal 8, ombre douce

#### Design Verso
- Fond : crème/parchemin `#FDF6E3`
- Bordure : 2px `#8D6E63` (brun bois)
- Layout flex colonne avec `padding: 16` :
  1. **Badge N° carte** : en haut à droite, fond `#C9A84C`, texte `#1A3C1A`, `fontSize: 11`, `fontWeight: '800'`
  2. **Nom courant** : `fontSize: 18`, `fontWeight: '800'`, couleur `#1A3C1A`
  3. **Nom latin** : italique, `fontSize: 14`, couleur `#5D4037`
  4. **Séparateur** : ligne `#C9A84C` opacité 0.4, height 1
  5. **Lieu** : `📍` + texte, `fontSize: 12`, couleur `#455A64`, `lineHeight: 18`
  6. **Anecdote** : fond `#E8F5E9`, padding 10, `borderRadius: 8`, texte vert foncé `#1B5E20`, `fontSize: 12`, `lineHeight: 17`, préfixé `💡`
  7. **Footer** : `marginTop: 'auto'`, `flexDirection: 'row'`, `justifyContent: 'space-between'`
     - Gauche : "🌲 ONF – Agir pour la forêt", `fontSize: 10`, vert
     - Droite : N° carte `#XX`, `fontSize: 10`, couleur `#9E9E9E`
- Hint retournement : `fontSize: 10`, couleur `#BDBDBD`, centré, sous le footer

#### Carte verrouillée (`locked=true`)
- Recto uniquement, pas de flip
- Fond sombre semi-transparent `rgba(0,0,0,0.6)` sur le fond vert
- Icône 🔒 centré, `fontSize: 32`
- Texte "???" sous l'icône, blanc

---

### 7. `src/components/ONF/TreeCardGallery.tsx`

Modal plein écran — collection complète.

#### Props
```ts
interface TreeCardGalleryProps {
  visible: boolean;
  onClose: () => void;
  onfSolvedCount: number;
  initialCardId?: number;  // focus sur cette carte à l'ouverture
}
```

#### Layout
- `Modal` RN, `animationType: 'slide'`, fond `#F5F0E8`
- Header : "🌲 Herbier de la Forêt" + bouton ✕ + sous-titre "X / 100 cartes"
- `FlatList` `numColumns={2}`, `keyExtractor={item => item.id}`, `removeClippedSubviews`
- Chaque cellule : `TreeCardView` size='mini' + `onPress` → ouvre `selectedCard`
- Dernière cellule (si < 100 cartes) : carte verrouillée mini avec "Encore X défis"
- Quand `selectedCard` non null : `Modal` imbriqué avec `TreeCardView` size='normal', centré, fond semi-transparent noir, bouton ✕

#### Scroll vers `initialCardId`
```ts
const flatListRef = useRef<FlatList>(null);
useEffect(() => {
  if (initialCardId && visible) {
    const index = collectedCards.findIndex(c => c.id === initialCardId);
    if (index >= 0) {
      setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: true }), 300);
    }
  }
}, [visible, initialCardId]);
```

---

### 8. `src/components/ONF/ONFCardUnlockBanner.tsx`

Pavé affiché dans la VictoryModal quand une carte est débloquée.

#### Props
```ts
interface ONFCardUnlockBannerProps {
  card: TreeCard;
  onDiscover: () => void;  // ouvre la galerie
}
```

#### Comportement
- Apparaît avec `withSpring` scale `0 → 1.1 → 1.0`, delay 400ms après montage
- Déclenche `<Confetti />` au montage (composant existant réutilisé)
- Layout :
  - Fond : dégradé `#1A3C1A → #2D6A2D`, `borderRadius: 16`, bordure or `#C9A84C 2px`
  - Titre : "🎊 1 carte débloquée !" blanc, bold, centré
  - `TreeCardView` size='mini' centré, non retournable (`startFlipped={false}`)
  - Bouton "Découvrir 🍃" → vert clair, appelle `onDiscover`

#### Confettis
Réutiliser `src/components/Game/Confetti.tsx` — déjà existant, déjà utilisé dans VictoryModal. Vérifier si on peut en déclencher un second ou s'il faut un état séparé.

---

### 9. `app/game/onf-lobby.tsx` — nouvelle route

Route `/game/onf-lobby`.

#### Layout
```
SafeAreaView fond #F5F0E8
  ScrollView
    Header : "🌲 Grille Forestière" + "Mode ONF"
    
    Bloc stats (fond blanc, radius 16, ombre légère) :
      "X défis réussis"   ← onfSolvedCount
      ── séparateur ──
      "Herbier de la Forêt"
      ProgressBar animée : (onfSolvedCount % 5) / 5
        [████░░░] X/5
      Texte : "Encore Y défi(s) pour débloquer une carte 🍃"
              ou "Collection complète ! 🏆" si toutes obtenues
    
    Aperçu prochaine carte (si pas collection complète) :
      TreeCardView locked=true size='mini' centré
      Texte "Prochaine carte"
    
    Bouton "Jouer" → router.push('/game/onf?size=3') ou size=4
    Bouton texte "Voir toutes mes cartes (X)" → setGalleryVisible(true)
    
  TreeCardGallery visible={galleryVisible} onClose={...}
```

#### Sélection taille grille
```ts
// Même logique que dans index.tsx :
const gridSize = player.onfSolvedCount >= ONF_4X4_UNLOCK_COUNT ? 4 : 3;
router.push(`/game/onf?size=${gridSize}`);
```

#### ProgressBar
Composant interne simple, Reanimated `withTiming` à l'entrée :
- Fond `#E0E0E0`, barre `#2D6A2D`, hauteur 12, radius 6, durée 600ms

---

### 10. `app/(tabs)/index.tsx` — mise à jour bouton ONF

**Remplacer** `router.push('/game/onf')` par `router.push('/game/onf-lobby')`.

**Remplacer** le sublabel par la logique suivante :
```ts
const onfSolved = player.onfSolvedCount;
const cards = getUnlockedCardCount(onfSolved);

// sublabel :
const sublabel = onfSolved === 0
  ? 'Gagnez votre 1er défi !'
  : cards === 1
    ? `${onfSolved} défis résolus · 1 carte 🍃`
    : `${onfSolved} défis résolus · ${cards} cartes 🍃`;
```

> Utiliser `onfSolvedCount` (compteur unifié de grilles résolues) et non `completedOnfChallengeIds.length` qui compte les IDs uniques de défis distincts — vérifier lequel est incrémenté par `recordOnfVictory`.

---

### 11. `app/game/onf.tsx` — logique victoire carte

Dans `useEffect([game.isVictory])`, **après** `player.recordOnfVictory(...)` (ligne ~267) :

```ts
// ── Cartes à collectionner ─────────────────────────
const countBefore = stateBeforeOnf.onfSolvedCount;  // déjà capturé ligne 254
const stateAfterCards = usePlayerStore.getState();
const countAfter = stateAfterCards.onfSolvedCount;

const justUnlocked = getJustUnlockedCard(countBefore, countAfter);
if (justUnlocked) {
  player.collectTreeCard(justUnlocked.id);
  setJustUnlockedCard(justUnlocked);  // état local → déclenche ONFCardUnlockBanner
  // Sync Firestore (s'ajoute aux syncs existants)
  const finalState = usePlayerStore.getState();
  if (uid) updateCollectedCards(uid, finalState.collectedTreeCardIds).catch(() => {});
}
```

**États locaux à ajouter :**
```ts
const [justUnlockedCard, setJustUnlockedCard] = useState<TreeCard | null>(null);
const [galleryVisible, setGalleryVisible] = useState(false);
```

**Dans le JSX, après `<VictoryModal>` :**
```tsx
{justUnlockedCard && game.isVictory && (
  <ONFCardUnlockBanner
    card={justUnlockedCard}
    onDiscover={() => setGalleryVisible(true)}
  />
)}
<TreeCardGallery
  visible={galleryVisible}
  onClose={() => setGalleryVisible(false)}
  onfSolvedCount={player.onfSolvedCount}
  initialCardId={justUnlockedCard?.id}
/>
```

**Reset :** `setJustUnlockedCard(null)` dans `onNextChallenge` et `onBackToMenu` de `VictoryModal`.

---

### 12. i18n — clés à ajouter

**`fr.json` :**
```json
"onf_btn_first_win": "Gagnez votre 1er défi !",
"onf_btn_stats_one_card": "{{count}} défis résolus · 1 carte 🍃",
"onf_btn_stats_cards": "{{count}} défis résolus · {{cards}} cartes 🍃",
"onf_lobby_title": "Grille Forestière",
"onf_lobby_mode": "Mode ONF",
"onf_lobby_solved": "{{count}} défi réussi",
"onf_lobby_solved_plural": "{{count}} défis réussis",
"onf_lobby_progress": "{{current}}/{{total}} avant une nouvelle carte",
"onf_lobby_remaining": "Encore {{n}} défi pour débloquer une carte 🍃",
"onf_lobby_remaining_plural": "Encore {{n}} défis pour débloquer une carte 🍃",
"onf_lobby_complete": "Collection complète ! 🏆",
"onf_lobby_next_card": "Prochaine carte",
"onf_lobby_play": "Jouer",
"onf_lobby_see_cards": "Voir toutes mes cartes ({{count}})",
"onf_card_unlocked": "🎊 1 carte débloquée !",
"onf_card_discover": "Découvrir 🍃",
"gallery_title": "Herbier de la Forêt",
"gallery_subtitle": "{{owned}} / {{total}} cartes",
"gallery_locked": "Encore {{n}} défi",
"gallery_locked_plural": "Encore {{n}} défis",
"card_flip_hint": "Toucher pour retourner",
"card_onf_credit": "🌲 ONF – Agir pour la forêt"
```

**`en.json` :** traductions équivalentes.

---

## Points d'attention / risques

### Metro require() statique
`require()` d'images en React Native/Metro **doit être statique** — pas de calcul dynamique dans le chemin. La map `TREE_IMAGES: Record<number, any>` avec 100 `require()` explicites est obligatoire. Alternative : un fichier `treeImages.ts` dédié.

### Compteur `onfSolvedCount` vs `completedOnfChallengeIds.length`
Dans `index.tsx` ligne 840 : `const solved = player.completedOnfChallengeIds.length` (IDs uniques). Dans le store : `onfSolvedCount` (toutes les parties gagnées, peut dépasser 100). **Utiliser `onfSolvedCount`** pour les cartes (on peut rejouer le même défi et accumuler des parties).

### Placement du banner dans onf.tsx
`ONFCardUnlockBanner` doit être positionné **par-dessus** la VictoryModal (z-index). Utiliser un `Modal` RN supplémentaire ou un `position: 'absolute'` avec z-index élevé dans le JSX de `onf.tsx`. Préférer un second `Modal` pour éviter les conflits.

### Android backfaceVisibility
Technique opacity+scaleX retenue — plus fiable que `backfaceVisibility: 'hidden'` sur Android avec Reanimated 4.5.

### Reset justUnlockedCard
Si l'utilisateur ferme la VictoryModal sans appuyer sur "Découvrir", puis rejoue et gagne encore sans franchir un palier, `justUnlockedCard` doit être `null`. Toujours reset dans `onNextChallenge` et `onBackToMenu`.

### Sync Firestore `collectedTreeCardIds`
S'ajoute aux syncs existants dans `upsertPlayer()`. Ajouter le champ dans l'objet passé à `upsertPlayer` aux lignes 330-343 de `onf.tsx`.

---

## Validation

- [ ] 0 défi → bouton index affiche "Gagnez votre 1er défi !"
- [ ] 3 défis → bouton affiche "3 défis résolus · 0 carte 🍃"
- [ ] 5 défis → bouton affiche "5 défis résolus · 1 carte 🍃", banner dans VictoryModal au 5e défi
- [ ] Lobby : progress bar animée, carte verrouillée visible
- [ ] Galerie : 100 cartes, grille 2 colonnes, tap → grande carte retournable
- [ ] Recto : image + nom français
- [ ] Verso : nom courant, nom latin, lieu, anecdote, "ONF – Agir pour la forêt", N° carte
- [ ] Hors-ligne : recto fonctionne (image locale), verso fonctionne (même image locale)
- [ ] Firestore : `collectedTreeCardIds` mis à jour après chaque carte débloquée
- [ ] `restoreFromCloud` : union sans doublon
- [ ] Android + iOS : animation retournement fluide
- [ ] Pas de doublon dans `collectedTreeCardIds` si victoire déclenchée deux fois (guard `includes`)
