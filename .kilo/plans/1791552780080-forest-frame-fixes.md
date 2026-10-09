# Plan — ForestFrame : 3 corrections visuelles

## Problèmes à corriger

1. **Cadre dépasse en bas** — le cadre PNG (ratio 1.792) est plus haut que l'écran sur la plupart des appareils. Actuellement il est centré → il déborde en haut ET en bas. Il faut l'aligner par le bas : le bas du PNG = le bas de l'écran, et clipper/cacher ce qui dépasse en haut.
2. **Indicateur actif non visible** — remplacer le `GlowDot` (halo semi-transparent large, invisible sur le bois) par un petit voyant vert solide (≈ 8 px de diamètre) positionné juste au-dessus de chaque bouton.
3. **Contenu masqué par la bordure basse du cadre** — les onglets Rules, Challenge et Profile n'ont pas de `paddingBottom` suffisant. Il faut ajouter un `paddingBottom` calculé à partir de la hauteur visible de la bordure bois.

---

## Décisions de design

### Fix 1 — Alignement du cadre

**Logique actuelle :** `cadreTop = (screenH - cadreH) / 2` → centré, déborde en haut et en bas.

**Nouvelle logique :** Aligner le bas du cadre avec le bas de l'écran.
```
cadreTop = screenH - cadreH   // valeur négative → le haut du PNG sort hors écran (vers le haut)
```
Le `View` conteneur de l'image garde `height: cadreH` mais est positionné à `top: cadreTop` (négatif). L'`absoluteFill` parent (avec `overflow: 'hidden'`) masque ce qui dépasse en haut.

**Largeur :** Toujours caler sur la largeur :
```
cadreW = screenW
cadreH = screenW * CADRE_RATIO
cadreTop = screenH - cadreH   // négatif si cadreH > screenH
cadreLeft = 0
```

**Overflow :** Le `View style={StyleSheet.absoluteFill}` racine doit avoir `overflow: 'hidden'` pour clipper ce qui dépasse vers le haut.

### Fix 2 — Petit voyant vert

Remplacer `GlowDot` par `ActiveDot` :
- Cercle solide, diamètre = 8 px
- Couleur `#48D250` (vert forêt)
- Ombre verte légère (`shadowOpacity: 0.8`, `shadowRadius: 4`)
- Positionné au **centre** de la zone de tap (centré horizontalement et verticalement dans la zone de tap), ou légèrement **au-dessus** du centre si les boutons ont une icône en haut.

La position exacte (relative à la zone de tap) sera un offset vertical configurable : `DOT_OFFSET_Y = -tapHalf * 0.5` (légèrement vers le haut du bouton). À ajuster après test visuel.

Supprimer complètement `GlowDot` et son `Animated`.

### Fix 3 — Padding bas des onglets

La bordure bois basse du cadre occupe environ `(1 - BTN_Y_CENTER) * cadreH` de hauteur depuis le bas de l'écran, soit `(1 - 0.935) * screenH ≈ 0.065 * screenH` (en supposant cadreH ≈ screenH). En pratique ~55–70 px selon l'appareil.

**Approche :** Exporter une constante `FRAME_BOTTOM_HEIGHT` depuis `ForestFrame.tsx` ou un module dédié, calculée comme :
```ts
// Dans src/constants/frameLayout.ts (nouveau fichier)
export const CADRE_RATIO = 2752 / 1536;
export const BTN_Y_CENTER = 0.935;
// Fraction de screenH occupée par la bordure basse du cadre
export const FRAME_BOTTOM_FRACTION = 1 - BTN_Y_CENTER; // 0.065
```

Dans chaque onglet, remplacer le `paddingBottom` fixe par :
```ts
import { useWindowDimensions } from 'react-native';
const { height } = useWindowDimensions();
const frameBottom = height * FRAME_BOTTOM_FRACTION;
// paddingBottom = insets.bottom + frameBottom + 16 (marge sécurité)
```

**Fichiers à modifier :**
- `app/(tabs)/rules.tsx` — ligne 94 : `paddingBottom: insets.bottom + 32` → `insets.bottom + frameBottom + 16`
- `app/(tabs)/challenge.tsx` — ligne 1033 : `paddingBottom: 40` → `insets.bottom + frameBottom + 16`
- `app/(tabs)/profile.tsx` — ligne 557 : `paddingBottom: 40` → `insets.bottom + frameBottom + 16`
- `app/(tabs)/index.tsx` — lignes 194 et 461 : `paddingBottom: insets.bottom + 90` — à conserver ou augmenter légèrement si insuffisant (90 est déjà généreux, à vérifier)

---

## Tâches ordonnées

### 1. Créer `src/constants/frameLayout.ts`
```ts
// Constantes partagées de mise en page du cadre ForestFrame
export const CADRE_NATIVE_W = 1536;
export const CADRE_NATIVE_H = 2752;
export const CADRE_RATIO = CADRE_NATIVE_H / CADRE_NATIVE_W; // ≈ 1.792
export const BTN_Y_CENTER = 0.935;      // fraction Y des boutons dans le cadre
export const BTN_X_CENTERS = [0.193, 0.397, 0.603, 0.808]; // fractions X
export const FRAME_BOTTOM_FRACTION = 1 - BTN_Y_CENTER;      // 0.065
```

### 2. Modifier `src/components/Navigation/ForestFrame.tsx`

a. Importer depuis `frameLayout.ts` (supprimer les constantes dupliquées locales).

b. **Fix 1 — Alignement :** changer le calcul :
```ts
// Toujours scale sur la largeur
const cadreW = screenW;
const cadreH = screenW * CADRE_RATIO;
const cadreLeft = 0;
const cadreTop = screenH - cadreH; // négatif si cadreH > screenH
```

c. Ajouter `overflow: 'hidden'` sur le `View style={StyleSheet.absoluteFill}` racine.

d. **Fix 2 — ActiveDot :** supprimer `GlowDot` et `Animated`. Ajouter :
```tsx
function ActiveDot() {
  const SIZE = 8;
  return (
    <View
      pointerEvents="none"
      style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        backgroundColor: '#48D250',
        shadowColor: '#48D250', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8, shadowRadius: 4, elevation: 6,
      }}
    />
  );
}
```

e. Dans le rendu des boutons, positionner `ActiveDot` **centré** dans la zone de tap (`alignItems: 'center', justifyContent: 'center'`).

f. Mettre à jour `btnY` :
```ts
const btnY = BTN_Y_CENTER * cadreH + cadreTop;
// = BTN_Y_CENTER * cadreH + (screenH - cadreH)
// = screenH - (1 - BTN_Y_CENTER) * cadreH
// = screenH - FRAME_BOTTOM_FRACTION * cadreH
```

### 3. Modifier `app/(tabs)/rules.tsx`
- Importer `FRAME_BOTTOM_FRACTION` depuis `frameLayout.ts`
- Ajouter `const { height } = useWindowDimensions()` (déjà importé)
- Calculer `const frameBottom = height * FRAME_BOTTOM_FRACTION`
- Ligne 94 : `paddingBottom: insets.bottom + frameBottom + 16`

### 4. Modifier `app/(tabs)/challenge.tsx`
- Importer `FRAME_BOTTOM_FRACTION`
- Calculer `frameBottom`
- Ligne 1033 : `paddingBottom: insets.bottom + frameBottom + 16`
- S'assurer que le `ScrollView` principal (ou le `View` conteneur) utilise ce padding

### 5. Modifier `app/(tabs)/profile.tsx`
- Importer `FRAME_BOTTOM_FRACTION`
- Calculer `frameBottom`
- Ligne 557 : `paddingBottom: insets.bottom + frameBottom + 16`

### 6. Vérifier `app/(tabs)/index.tsx`
- `paddingBottom: insets.bottom + 90` — vérifier visuellement si 90 suffit (≈ `0.065 * 860 + 16 ≈ 72`). Si insuffisant, remplacer par `insets.bottom + frameBottom + 16` de la même façon.

---

## Points de vigilance

- `overflow: 'hidden'` sur le `View` racine de `ForestFrame` ne doit pas bloquer les événements touch : `pointerEvents="box-none"` doit rester sur ce `View`. Tester que les boutons restent cliquables après l'ajout de `overflow: 'hidden'`.
- Sur iOS, `overflow: 'hidden'` et `pointerEvents="box-none"` fonctionnent ensemble sans problème documenté.
- Le `cadreTop` négatif implique que la partie haute du PNG (forêt, ciel) est hors écran — c'est voulu : seule la bordure basse (avec les boutons) doit rester visible.
- Si les boutons se retrouvent trop proches du bas, ajuster `BTN_Y_CENTER` après test visuel (les positions ont été mesurées sur le PNG orignal mais peuvent dériver selon le device).

---

## Validation

1. Sur device (iPhone / Android) : vérifier que le cadre ne dépasse plus en bas.
2. Naviguer sur chaque onglet actif : le voyant vert doit être visible sur le bon bouton.
3. Scroller dans Rules, Challenge et Profile jusqu'en bas : le dernier élément ne doit pas être masqué par la bordure bois.
4. Sur un écran large (tablet) : vérifier que le cadre ne déborde pas horizontalement (cadreW = screenW garantit cela).
