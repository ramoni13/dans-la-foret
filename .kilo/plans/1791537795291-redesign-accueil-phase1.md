# Redesign — Accueil (Phase 1)

## Objectif
Remplacer l'UI froide de `app/(tabs)/index.tsx` par une UI chaude et immersive en utilisant les assets graphiques fournis dans `assets/elements/design_app/`. Aucune dépendance externe supplémentaire.

## Assets disponibles
| Fichier | Rôle |
|---|---|
| `assets/elements/sprites/fond-ecran.jpg` | Fond plein écran (déjà en place) |
| `assets/elements/design_app/panneau_bois.png` | Panneau bois suspendu — titre de section, badge graines |
| `assets/elements/design_app/bloc_vert.png` | Bouton d'action principal (Jouer/Continuer) |
| `assets/elements/design_app/bloc_jaune.png` | Bouton d'action secondaire (Défi du Jour, Tous les défis) |
| `assets/elements/design_app/rond_graines.png` | Icône monnaie dans le badge graines |

## Décisions prises
- **Scope** : `app/(tabs)/index.tsx` uniquement (+ 2 composants UI réutilisables à créer)
- **Overlay** : `rgba(0,0,0,0.20)` — forêt très visible, ambiance chaude
- **Header** : supprimer le titre "Dans la Forêt" — le remplacer par le badge graines sur `panneau_bois.png`
- **Cartes** : titre/action de chaque carte sur `panneau_bois.png` ; corps sur fond `rgba(40,20,5,0.72)` brun chaud
- **Bouton Continuer** : `bloc_vert.png` comme `ImageBackground`
- **Bouton Défi du Jour** (disponible) : `bloc_jaune.png` comme `ImageBackground`
- **Bouton Tous les défis** : `panneau_bois.png` comme fond
- **Tab bar** : inchangée dans cette phase

## Composants à créer
### `src/components/UI/WoodSign.tsx`
Panneau bois réutilisable. Props :
```ts
interface WoodSignProps {
  label: string;         // Texte principal
  sublabel?: string;     // Texte secondaire optionnel
  iconLeft?: string;     // Emoji/icône à gauche
  iconRight?: string;    // Emoji/icône à droite (ex: "→")
  height?: number;       // Hauteur (défaut 68)
  width?: number|string; // Largeur (défaut '100%')
  onPress?: () => void;  // Si défini : TouchableOpacity, sinon View
  disabled?: boolean;
}
```
Implémentation : `ImageBackground` avec `panneau_bois.png` + `resizeMode="stretch"` + texte centré en `color: '#FFF8E7'`, `fontWeight: '800'`, `textShadow`.

### `src/components/UI/WoodButton.tsx`
Bouton action sur bloc coloré. Props :
```ts
interface WoodButtonProps {
  label: string;
  sublabel?: string;
  variant: 'green' | 'yellow'; // bloc_vert ou bloc_jaune
  iconLeft?: string;
  iconRight?: string;
  height?: number;             // défaut 72
  onPress: () => void;
  disabled?: boolean;
  animated?: boolean;          // wrap dans Animated.View si true
  animatedStyle?: any;         // style Animated (ex: transform scale)
}
```
Implémentation : `ImageBackground` avec `bloc_vert.png` ou `bloc_jaune.png` + `resizeMode="stretch"` + contenu flex row.

## Plan de modification de `index.tsx`

### 1. Imports à ajouter
```ts
import { WoodSign } from '../../src/components/UI/WoodSign';
import { WoodButton } from '../../src/components/UI/WoodButton';
```

### 2. BgImage — modifier l'overlay
```ts
// Avant
{ backgroundColor: 'rgba(0,0,0,0.48)' }
// Après
{ backgroundColor: 'rgba(0,0,0,0.20)' }
```

### 3. Hero — remplacer titre + badge graines
```tsx
// Avant
<View style={styles.hero}>
  <Text style={styles.heroTitle}>Dans la Forêt</Text>
  <View style={styles.seedsHeroBadge}>
    <Text style={styles.seedsHeroText}>🌱 {player.seeds} graines</Text>
  </View>
</View>

// Après : panneau bois avec icône graines + compteur
<WoodSign
  label={`🌱 ${player.seeds} graines`}
  height={56}
  width={220}
  static   // non cliquable
/>
```
Le `WoodSign` centré horizontalement via `alignItems: 'center'` sur le container parent.

### 4. Défi du Jour — état "disponible"
```tsx
// Avant : styles.dailyCard (fond #C8950F)
// Après : WoodButton variant="yellow"
<Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
  <WoodButton
    variant="yellow"
    iconLeft="🌅"
    label="Défi du Jour"
    sublabel="Clairière Secrète · 15 cases"
    iconRight="→"
    height={80}
    onPress={() => router.push('/game/daily')}
    animated={false}
  />
</Animated.View>
```
Pour les états "réussi" / "échoué" / "verrouillé" : conserver les styles actuels adaptés aux couleurs chaudes (pas de bloc PNG car pas interactif ou état terminal).

### 5. Carte "Continuer"
```tsx
// Avant : styles.resumeCard (fond rgba(20,55,20,0.88))
// Après : WoodButton variant="green"
<WoodButton
  variant="green"
  iconLeft={allCompleted ? '🏆' : totalCompleted === 0 ? '🌱' : '▶️'}
  label={allCompleted ? 'Tout terminé !' : totalCompleted === 0 ? 'Commencer' : 'Continuer'}
  sublabel={`${nextChallenge.level.emoji} ${nextChallenge.level.label} · Défi n°${nextChallenge.challenge.challengeNumber}`}
  iconRight="→"
  height={80}
  onPress={() => router.push(`/game/${nextChallenge.challenge.id}`)}
/>
```

### 6. Bouton "Tous les défis"
```tsx
// Avant : styles.allChallengesBtn (fond rgba blanc)
// Après : WoodSign cliquable
<WoodSign
  iconLeft="🗺️"
  label="Tous les défis"
  sublabel={`${totalCompleted}/${totalChallenges} complétés`}
  iconRight="→"
  height={72}
  onPress={() => setShowLevels(true)}
/>
```

### 7. Styles à mettre à jour
- Supprimer : `heroTitle`, `seedsHeroBadge`, `seedsHeroText`, `resumeCard`, `resumeLeft`, `resumeIcon`, `resumeCenter`, `resumeAction`, `resumeLevel`, `resumeChallenge`, `resumeArrow`, `allChallengesBtn`, `allChallengesBtnEmoji`, `allChallengesBtnCenter`, `allChallengesBtnTitle`, `allChallengesBtnSub`, `allChallengesBtnArrow`, `dailyCard` (remplacé)
- Garder et adapter : `dailyCardLocked`, `dailyCardSuccess`, `dailyCardFailed` — remplacer leurs `backgroundColor` par des teintes brunes chaudes :
  - Success : `rgba(30,70,15,0.85)` + border `rgba(120,200,80,0.5)`
  - Failed : `rgba(50,25,10,0.85)` + border `rgba(150,100,50,0.3)`
  - Locked : `rgba(30,15,5,0.65)` + border `rgba(120,80,40,0.2)`
- `hero` : `{ alignItems: 'center', paddingVertical: 8 }` (inchangé structurellement)
- `container` gap : passer de `14` à `16`

## Fichiers touchés
| Fichier | Action |
|---|---|
| `src/components/UI/WoodSign.tsx` | **Créer** |
| `src/components/UI/WoodButton.tsx` | **Créer** |
| `app/(tabs)/index.tsx` | **Modifier** (BgImage overlay + Hero + 3 cartes + styles) |

## Fichiers NON touchés dans cette phase
- `app/(tabs)/rules.tsx`
- `app/(tabs)/challenge.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/_layout.tsx`
- `app/game/*.tsx`
- `src/constants/colors.ts`

## Validation
1. `npx expo start` — vérifier visuellement sur iOS/Android/Web
2. Overlay forêt bien visible (pas trop sombre)
3. `panneau_bois.png` affiché sans déformation (`resizeMode="stretch"`)
4. Boutons verts/jaunes avec texte lisible centré
5. Animation pulse du Défi du Jour toujours fonctionnelle
6. Tous les états du Défi du Jour (verrouillé, disponible, réussi, échoué) affichés correctement
7. Navigation (Continuer → jeu, Tous les défis → LevelsScreen, Défi du Jour → daily) inchangée

## Risques
- `resizeMode="stretch"` sur les PNG peut déformer si les proportions des assets ne correspondent pas aux hauteurs choisies — ajuster `height` si nécessaire après test visuel
- Sur web, `ImageBackground` fonctionne mais peut nécessiter `overflow: 'hidden'` explicite
- Les assets PNG ont potentiellement des zones transparentes — tester sur fond forêt pour s'assurer du rendu
