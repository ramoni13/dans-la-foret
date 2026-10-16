# Plan — Restructuration UI & fonctionnelle

## Objectif
Alléger et restructurer l'interface selon l'Option A : supprimer l'onglet Défis, faire de l'Accueil le point d'entrée principal du jeu, épurer le Profil, poser le fond illustré, et traiter les points fonctionnels (connexion persistante, streak, notifications amis).

---

## Décisions architecturales

### Tab bar (4 onglets)
| Avant | Après |
|---|---|
| 🏠 Accueil | 🌲 Jouer (ex-Accueil, enrichi) |
| 🌲 Défis | ~~supprimé~~ |
| 📖 Règles | 📖 Règles |
| ⚔️ Amis | ⚔️ Amis |
| 👤 Profil | 👤 Profil |

**Navigation vers les défis passés :** puisque l'écran Niveaux disparaît, le navigateur de niveaux (carrousel ‹/›) est intégré directement dans l'écran Jouer, accessible via un bouton/section "Voir tous les défis" qui déroule le sélecteur in-page (pas de nouvel écran — ScrollView avec section collapsible ou modal bottom-sheet simple).

### Profil : sous-menus tuile
L'onglet Profil connecté devient un hub avec 4 tuiles-planches :
- **Stats** — métriques (graines, défis résolus, meilleures séries, meilleur temps, streak quotidien)
- **Badges** — `BadgeCollection` + `BadgeUnlockProgress`
- **Classement** — `LeaderboardScreen`
- **Réglages** — langue, musique (`MusicPanel`), notifications, déconnexion, reset progression

Chaque tuile navigue vers un sous-écran. Implémenter via des vues conditionnelles dans `profile.tsx` (pas de fichier de route supplémentaire — garder la logique dans l'onglet existant avec un state `activeSection`).

---

## Tâches ordonnées

### 1. Fond d'écran Accueil
- Ajouter `ImageBackground` (ou `Image` + `StyleSheet.absoluteFillObject`) dans `app/(tabs)/index.tsx`
- Source : `assets/sprites/Gemini_Generated_Image_mhh6w8mhh6w8mhh6.jpg`
- Style : `resizeMode="cover"`, occuper tout l'écran derrière le contenu
- Ajouter un overlay semi-transparent (`rgba(0,0,0,0.35)`) pour garantir la lisibilité du texte sur fond illustré

### 2. Épuration de l'écran Accueil (`app/(tabs)/index.tsx`)
Supprimer :
- Bouton "⚔️ Défier un ami" + bouton "👤 Mon profil" (section `actions`)
- Carte "Stats rapides" (défis résolus + série en cours)
- Supprimer les styles associés : `actions`, `btnSecondary`, `btnSecondaryText`, `btnTertiary`, `btnTertiaryText`, `statsCard`, `stat`, `statValue`, `statLabel`, `statDivider`

Conserver :
- Hero (titre + graines)
- Carte Défi du Jour
- Carte Prochain défi / Continuer

### 3. Intégration du navigateur de défis dans l'Accueil
Déplacer depuis `app/(tabs)/levels.tsx` vers `app/(tabs)/index.tsx` :
- Carrousel ‹ Niveau X ›  avec flèche gauche/droite
- Liste des défis du niveau sélectionné (ScrollView)
- Logique de déblocage progressif (`isLevelUnlocked`, `isChallengeUnlocked`)
- World records en temps réel (`subscribeAllWorldRecords`)

Le tout est placé sous la carte "Continuer", dans la même ScrollView, dans une section intitulée "Tous les défis". Pas de collapsible pour simplifier — la ScrollView s'allonge naturellement.

### 4. Suppression de `app/(tabs)/levels.tsx`
- Supprimer le fichier `app/(tabs)/levels.tsx`
- Retirer l'entrée `levels` dans `app/(tabs)/_layout.tsx`
- Vérifier et nettoyer les imports et routes pointant vers `/(tabs)/levels`

### 5. Mise à jour de la tab bar (`app/(tabs)/_layout.tsx`)
- Passer de 5 à 4 onglets : `index`, `rules`, `challenge`, `profile`
- Changer le label/emoji de l'onglet `index` : `tabBarIcon` → 🌲, `title` → `'Jouer'`
- Afficher les labels (`tabBarShowLabel: true`)
- Ajuster `tabBarHeight` si besoin avec les 4 onglets

### 6. Refonte de l'écran Profil connecté (`app/(tabs)/profile.tsx`)
Remplacer les 3 onglets internes (`progression | badges | classement`) par 4 tuiles-planches.

**Nouvel état :** `activeSection: 'hub' | 'stats' | 'badges' | 'classement' | 'reglages'`

**Hub (état initial)** — grille 2×2 de tuiles :
- `Stats` + icône 📊
- `Badges` + icône 🏅 + badge count
- `Classement` + icône 🌍
- `Réglages` + icône ⚙️

En dessous des tuiles : avatar + nom du joueur + graines (compact).

**Section Stats** :
- Graines disponibles
- Défis résolus
- Meilleure série (`longestStreak`)
- Meilleur temps
- Streak quotidien (`dailyChallengeStreak`)
- **NE PAS afficher `currentStreak`** (voir §Streak ci-dessous)
- Bouton retour → hub

**Section Badges** : `BadgeCollection` + `BadgeUnlockProgress` — identique à l'onglet actuel

**Section Classement** : `LeaderboardScreen`

**Section Réglages** :
- Sélecteur de langue
- `MusicPanel`
- Toggle notifications amis (voir §Notifications)
- Bouton "Se déconnecter"
- Bouton "Réinitialiser la progression"

Supprimer :
- Section "Par niveau" (progress bars par niveau)
- La carte Premium (laisser uniquement pour plus tard)
- Les onglets horizontaux existants

### 7. `currentStreak` — audit et décision
**Constat :** `stats.currentStreak` est incrémenté à chaque défi complété sans jamais être remis à zéro (sauf logout). Il ne représente pas une série quotidienne mais un compteur cumulatif d'achèvements. Il n'est utilisé dans aucun badge. Il est affiché dans l'Accueil actuel et dans le Profil.

**Action :** Ne plus l'afficher dans aucun écran. Garder la donnée dans le store pour compatibilité ascendante (ne pas casser les profils existants). Pas de migration nécessaire.

La série pertinente à afficher est `dailyChallengeStreak` (jours consécutifs de défi du jour réussi) dans la section Stats du Profil.

### 8. Connexion persistante (Firebase Auth)
**Problème :** Firebase Auth SDK JS gère déjà la persistance de session via `localStorage` (web) et `AsyncStorage` (mobile via `@firebase/auth`). Si l'utilisateur doit se reconnecter à chaque ouverture, c'est que la persistance n'est pas configurée.

**Action :**
- Dans `src/services/firebase.ts`, initialiser `getAuth` avec `initializeAuth` + persistance explicite :
  - **Mobile** : `getReactNativePersistence(AsyncStorage)` de `firebase/auth/react-native`
  - **Web** : `browserLocalPersistence` (déjà par défaut — vérifier que rien ne l'écrase)
- Importer `AsyncStorage` depuis `@react-native-async-storage/async-storage`
- Ajouter `Platform.select` pour différencier web/native

**Risque :** Ce changement affecte `firebase.ts` qui est le point d'initialisation unique. Tester sur mobile et web. Ne pas casser le flow `onAuthChange` dans `_layout.tsx`.

### 9. Notifications amis — MVP store-side
Les notifications push (Expo Notifications) sont hors scope pour ce plan — elles nécessitent un backend et une gestion des tokens de push. Ce plan couvre uniquement la **notification in-app** (badge rouge sur l'onglet Amis quand un défi ami est en attente).

**Action :**
- Dans `app/(tabs)/_layout.tsx`, ajouter un `useEffect` qui s'abonne aux défis amis en attente pour le joueur connecté (via Firestore `onSnapshot` sur `challengeService`) et met à jour un state local `pendingChallengesCount`
- Passer `pendingChallengesCount` au `tabBarBadge` de l'onglet `challenge` via les `screenOptions` Expo Router (propriété `tabBarBadge`)
- Ajouter un toggle "Afficher le badge de notification amis" dans la section Réglages du Profil, persisté dans `playerStore` (nouveau champ `friendNotifBadgeEnabled: boolean`)

**Ce qui reste hors scope :** push notifications système, autorisation OS, gestion des tokens Expo.

---

## Fichiers modifiés

| Fichier | Type de modification |
|---|---|
| `app/(tabs)/index.tsx` | Refonte majeure : fond illustré, suppression sections, ajout navigateur de défis |
| `app/(tabs)/levels.tsx` | **Suppression** |
| `app/(tabs)/_layout.tsx` | 4 onglets, labels visibles, badge amis |
| `app/(tabs)/profile.tsx` | Refonte profil connecté : hub + sous-sections |
| `src/services/firebase.ts` | Persistance Auth explicite (mobile) |
| `src/store/playerStore.ts` | Ajout `friendNotifBadgeEnabled: boolean` + action setter |
| `src/hooks/useStorage.ts` | Persister `friendNotifBadgeEnabled` |

---

## Risques & points d'attention

1. **`levels.tsx` supprimé** : vérifier que `router.push('/(tabs)/levels')` n'apparaît nulle part ailleurs (`app/(tabs)/index.tsx` ligne 263 → sera remplacé par navigation in-page).
2. **Auth persistante mobile** : `initializeAuth` avec `getReactNativePersistence` doit être appelé **avant** tout autre appel Firebase Auth. Si `getAuth` est déjà appelé quelque part avant ce changement, il faut passer à `initializeAuth`.
3. **Image fond** : le fichier `Gemini_Generated_Image_mhh6w8mhh6w8mhh6.jpg` est dans `assets/sprites/` — Metro peut bundler des JPG natifs via `require()`. Vérifier que Metro ne filtre pas les fichiers `.jpg` dans ce dossier.
4. **`currentStreak` affiché dans index.tsx ligne 311** : supprimer lors de la suppression de la section Stats rapides.
5. **Guard auth** : `levels.tsx` a sa propre garde de connexion. Après suppression, s'assurer que la section navigateur de défis dans `index.tsx` hérite bien de la garde existante (déjà en place dans `index.tsx`).

---

## Validation

- [ ] L'app démarre sans crash sur mobile et web
- [ ] La tab bar affiche 4 onglets avec labels
- [ ] Le fond illustré couvre tout l'écran Jouer sans distordre
- [ ] La carte "Continuer" et la carte Défi du Jour sont visibles et fonctionnelles
- [ ] Le navigateur de niveaux (‹/›) est opérationnel dans l'écran Jouer
- [ ] `app/(tabs)/levels` n'est plus accessible (route supprimée)
- [ ] Le Profil connecté affiche le hub 4 tuiles en état initial
- [ ] La section Stats n'affiche plus `currentStreak`
- [ ] La connexion persiste entre les relances de l'app (mobile)
- [ ] Le badge rouge sur l'onglet Amis apparaît quand un défi est en attente
- [ ] Le toggle notification dans Réglages fonctionne et est persisté
