# 🌲 SYSTÈME DE BADGES — Dans la Forêt
## Document de référence technique & game design

> **Version :** 3.0 — mise à jour avec temps de jeu réels, modèle freemium 2,99€, défis journaliers, XP vs graines  
> **Public cible :** Familial (7–77 ans)  
> **Références gamification :** Clash Royale, Royal Match, Duolingo  
> **Ce fichier est la référence pour toutes les prochaines étapes d'implémentation.**

---

## TABLE DES MATIÈRES

1. [Architecture technique actuelle](#1-architecture-technique-actuelle)
2. [Vérification des données en base](#2-vérification-des-données-en-base)
3. [Temps de jeu réels & impact sur les badges](#3-temps-de-jeu-réels--impact-sur-les-badges)
4. [Le mécanisme noErrorStreak — Attention !](#4-le-mécanisme-noerrorstreak--attention-)
5. [Graines seules suffisent-elles ? Graines vs XP](#5-graines-seules-suffisent-elles--graines-vs-xp)
6. [Les Défis Journaliers — Spécification complète](#6-les-défis-journaliers--spécification-complète)
7. [Modèle Freemium — Gratuit vs Premium 2,99€](#7-modèle-freemium--gratuit-vs-premium-299)
8. [Catalogue des 41 badges — analyse critique](#8-catalogue-des-41-badges--analyse-critique)
9. [Économie des graines — état actuel et problèmes](#9-économie-des-graines--état-actuel-et-problèmes)
10. [Analyse gamification — Points forts & faibles](#10-analyse-gamification--points-forts--faibles)
11. [Comparaison avec les meilleurs jeux](#11-comparaison-avec-les-meilleurs-jeux)
12. [Plan d'amélioration en 4 phases](#12-plan-damélioration-en-4-phases)
13. [La Clairière — Spécifications détaillées](#13-la-clairière--spécifications-détaillées)
14. [Nouvelle économie équilibrée](#14-nouvelle-économie-équilibrée)
15. [Nouveau catalogue de badges enrichi](#15-nouveau-catalogue-de-badges-enrichi)
16. [Cohérence de progression — Roadmap joueur](#16-cohérence-de-progression--roadmap-joueur)
17. [Référence implémentation — Todo ordonné](#17-référence-implémentation--todo-ordonné)

---

## 1. Architecture technique actuelle

### 1.1 Flux de données complet

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARTIE TERMINÉE (isVictory)                  │
│                    [challengeId].tsx                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. player.markChallengeCompleted(id, timeMs, failCount)        │
│     → Met à jour : completedChallenges, bestTimes,              │
│       noErrorStreak, sameChallengePlays, seasonalCount          │
│     (playerStore.ts — SET ZUSTAND IMMÉDIAT)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. evaluateBadges(ctx: GameContext)                            │
│     → Fonction pure, idempotente                                │
│     → Lit le store APRÈS markChallengeCompleted                 │
│     → Retourne les nouveaux badgeIds                            │
│     (badgeEngine.ts)                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. player.awardBadges(newBadges)                               │
│     → Un seul set() Zustand                                     │
│     → Cumule les graines (BADGE_SEED_REWARDS)                   │
│     → Recalcule unlockedBonuses + unlockedThemes                │
│     (playerStore.ts)                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌─────────────────────┐   ┌────────────────────────────────────┐
│  BadgeToast queue   │   │  Firestore (arrière-plan)          │
│  → Notifications    │   │  awardBadgesFirestore(uid, ids)    │
│    in-game animées  │   │  → arrayUnion (atomique)           │
│    avec feux        │   │  markCompleted()                   │
│    d'artifice       │   │  updateSeeds()                     │
│  (BadgeToast.tsx)   │   │  upsertLeaderboardEntry()          │
└─────────────────────┘   └────────────────────────────────────┘
```

### 1.2 Composants impliqués

| Fichier | Rôle |
|---------|------|
| `src/constants/badges.ts` | Catalogue des 41 badges + paliers RARITY_UNLOCKS + BADGE_SEED_REWARDS |
| `src/core/engine/badgeEngine.ts` | Évaluateur pur + getClosestBadges() |
| `src/services/badgeService.ts` | CRUD Firestore (awardBadges, getShowcase…) |
| `src/store/playerStore.ts` | État local (earnedBadges, seeds, streaks, stats) |
| `src/services/playerService.ts` | Profil Firestore + PlayerProfile interface |
| `app/game/[challengeId].tsx` | Orchestration victoire → badges → toast |
| `src/components/Badges/BadgeToast.tsx` | Notification slide-in + feux d'artifice |
| `src/components/Badges/BadgeCollection.tsx` | Grille complète avec filtres |
| `src/components/Badges/BadgeDetailModal.tsx` | Fiche de détail (bottom sheet) |
| `src/components/Badges/BadgeProgressInline.tsx` | Mini-barre VictoryModal |
| `src/components/Badges/BadgeUnlockProgress.tsx` | Barres de paliers par rareté |
| `src/components/Badges/BadgeCard.tsx` | Carte badge individuelle |
| `src/components/Badges/BadgeShowcase.tsx` | Vitrine 3 badges (mode défi amis) |

---

## 2. Vérification des données en base

### 2.1 Données stockées dans Firestore (`/players/{userId}`)

| Champ Firestore | Type | Utilisé pour badge | Status |
|----------------|------|-------------------|--------|
| `earnedBadges` | `string[]` | Idempotence | ✅ OK |
| `dailyStreak` | `number` | regularite_* | ✅ OK |
| `lastPlayedDate` | `string` (YYYY-MM-DD) | streak quotidien | ✅ OK |
| `stats.noErrorStreak` | `number` | precision_* | ✅ OK |
| `stats.bestTimes` | `Record<id, ms>` | amelioration_graphe | ✅ OK |
| `stats.sameChallengePlays` | `Record<id, n>` | amelioration_cycle, secret_boucle | ✅ OK |
| `stats.failCount` | `Record<id, n>` | secret_coeur_brise | ✅ OK |
| `stats.friendWins` | `number` | social_lion/loup/roi | ✅ OK |
| `stats.totalFriendsInvited` | `number` | social_poignee, social_cirque | ✅ OK (mais jamais incrémenté — voir §2.2) |
| `stats.topDEJCount` | `number` | social_trophee | ✅ OK (mais fonctionnalité absente) |
| `stats.seasonalChallengesPlayed` | `number` | saisonnier_* | ✅ OK |
| `stats.improvedChallengesCount` | `number` | amelioration_fusee | ⚠️ TRACKÉ mais NON UTILISÉ |
| `completedChallenges` | `string[]` | exploration_*, collectionneur | ✅ OK |
| `badgeShowcase` | `string[3]` | Vitrine profil | ✅ OK |

### 2.2 Bugs et incohérences détectés

#### ❌ Bug 1 — `amelioration_fusee` jamais déclenché
```typescript
// badgeEngine.ts — Le badge "Sur orbite" est défini pour "10 défis améliorés"
// MAIS evaluateBadges() n'a PAS de condition pour ce badge !
// Il est dans getClosestBadges() mais pas dans evaluateBadges().
// → Jamais attribué, impossible à obtenir.
```
**Fix :** Ajouter dans `evaluateBadges()` :
```typescript
if (ctx.improvedChallengesCount >= 10) award('amelioration_fusee');
// Mais ctx.improvedChallengesCount n'est pas dans GameContext non plus → double fix
```

#### ❌ Bug 2 — `amelioration_etoile` quasi-impossible
```typescript
// Condition : ratio < 0.20 (terminé en moins de 20% du temps estimé)
// Le temps estimé le plus élevé est ~60s (niveaux difficiles)
// 20% de 60s = 12s → atteignable
// MAIS 20% de 30s (niveau 1) = 6s → très difficile
// MAIS la description dit "< 20% du temps estimé sans erreur"
// alors que le badge vitesse_tornade est déjà pour < 4s...
// Ces deux badges se chevauchent conceptuellement.
```
**Fix :** Changer le seuil à 30% ou reformuler le badge.

#### ⚠️ Bug 3 — `totalFriendsInvited` jamais incrémenté
```typescript
// playerStore.ts expose recordFriendInvited()
// MAIS aucun écran ne l'appelle lors du flux d'invitation ami
// → social_poignee (1 ami invité) et social_cirque (5 amis) ne peuvent pas être obtenus
```
**Fix :** Appeler `player.recordFriendInvited()` dans le flux d'invitation (challenge screen).

#### ⚠️ Bug 4 — `earnedAt` non stockée
```typescript
// BadgeDetailModal affiche "Le [date]" pour les badges obtenus
// MAIS playerStore ne stocke pas la date d'obtention
// → earnedAtMap={} vide dans BadgeCollection
```
**Fix :** Stocker `earnedAt: Record<string, string>` dans le profil joueur.

#### ⚠️ Bug 5 — Badges régularité heure non fiables
```typescript
// regularite_lune : joue entre 22h et 6h pendant 3 jours CONSÉCUTIFS
// MAIS dailyStreak ne distingue pas l'heure → un streak de 3 jours suffit
// si au moins LA PARTIE ACTUELLE est entre 22h-6h
// → Le badge se déclenche si dailyStreak >= 3 et heure courante entre 22h-6h
// → Pas besoin que les 3 jours précédents soient aussi de nuit
```
**Fix v1 (simple) :** Garder la logique actuelle mais clarifier la description.
**Fix v2 (correct) :** Stocker `nightStreakCount` et `morningStreakCount` séparément.

#### ⚠️ Bug 6 — `improvedChallengesCount` non persisté proprement
```typescript
// Il est mis à jour dans markChallengeCompleted()
// MAIS il n'est pas dans le payload Firestore de markCompleted() dans playerService.ts
// → Seul le store local le connait, pas Firestore
```

#### ℹ️ Info — `topDEJCount` (top 3 défi du jour) 
```typescript
// Le champ existe en store + Firestore
// MAIS la fonctionnalité "défi du jour" avec classement n'est pas encore implémentée
// → recordTopDEJ() n'est jamais appelé → social_trophee impossible à obtenir
```

### 2.3 Données complètement disponibles (100% opérationnelles)

Ces badges peuvent être obtenus sans aucune correction :
- Toute la catégorie **Vitesse** (5 badges) ✅
- **precision_pousse, precision_oeil, precision_hibou, precision_arc, precision_couronne** ✅
- **regularite_aube, regularite_fougere, regularite_arbre, regularite_foret** ✅
- **amelioration_graphe, amelioration_cycle** ✅
- Toute la catégorie **Exploration** (sauf `exploration_crane` car niveau 14 non encore dispo) ✅
- Tous les **secrets** (fantome, noel, paques, boucle, coeur_brise) ✅
- Tous les **saisonniers** ✅
- **record_first, record_mondial** ✅

---

---

## 3. Temps de jeu réels & impact sur les badges

### 3.1 Données mesurées — `estimatedDuration` vs temps de jeu réel

Les valeurs `estimatedDuration` dans les JSON de défis sont **fixes par niveau** (tous les 10 défis d'un niveau ont le même estimé). Le temps de jeu réel mesuré par l'utilisateur est bien plus court :

| Niveau | `estimatedDuration` (s) | Temps réel moyen (s) | Ratio réel/estimé |
|--------|------------------------|---------------------|--------------------|
| 1 | **105 s** | ~10 s | **~10%** |
| 2 | **180 s** | ~20 s | **~11%** |
| 3 | **210 s** | ~30 s | **~14%** |
| 4 | **285 s** | ~35 s | **~12%** |
| 5 | **390 s** | ~40 s | **~10%** |
| 6 | **210 s** | ~30 s | **~14%** |
| 7 | **345 s** | ~45 s | **~13%** |
| 8 | **450 s** | ~55 s | **~12%** |
| 9 | **345 s** | ~45 s | **~13%** |
| 10 | **450 s** | ~60 s | **~13%** |
| 11 | **510 s** | ~65 s | **~13%** |
| 12 | **600 s** | ~75 s | **~13%** |
| 13 | **750 s** | ~90 s | **~12%** |

> ⚠️ **Conclusion critique :** Les `estimatedDuration` sont **7 à 10 fois supérieures** aux temps de jeu réels. Ces valeurs sont vraisemblablement des durées prévues pour des débutants absolus ou calculées pour une marge très généreuse. Elles ne reflètent pas la réalité.

### 3.2 Impact catastrophique sur les badges de vitesse

Les seuils actuels dans `badgeEngine.ts` sont en **secondes absolues** qui augmentent par niveau :

```
threshold_tortue  = 30 + (lvl - 1) × 10
threshold_renard  = 20 + (lvl - 1) × 7
threshold_oiseau  = 12 + (lvl - 1) × 5
threshold_eclair  =  7 + (lvl - 1) × 3
threshold_tornade =  4 + (lvl - 1) × 2
```

**Comparaison seuils actuels vs temps réels — Niveau 1 (avg 10s) :**

| Badge | Seuil actuel (Niv 1) | Temps réel moyen | Verdict |
|-------|---------------------|-----------------|--------|
| 🟤 vitesse_tortue | < 30 s | ~10 s | 🟢 Obtenu automatiquement, trop facile |
| ⚪ vitesse_renard | < 20 s | ~10 s | 🟢 Obtenu automatiquement, trop facile |
| 🟡 vitesse_oiseau | < 12 s | ~10 s | 🟡 Légèrement au-dessus de la moyenne |
| 🟡 vitesse_eclair | < 7 s | ~10 s | 🔴 Demande d'être 30% plus rapide que la moyenne |
| 💎 vitesse_tornade | < 4 s | ~10 s | 🔴 Presque impossible (40% de la moyenne) |

**Comparaison seuils actuels vs temps réels — Niveau 5 (avg 40s) :**

| Badge | Seuil actuel (Niv 5) | Temps réel moyen | Verdict |
|-------|---------------------|-----------------|--------|
| 🟤 vitesse_tortue | < 70 s | ~40 s | 🟢 Trivial, toujours trop facile |
| ⚪ vitesse_renard | < 48 s | ~40 s | 🟡 Légèrement au-dessus de la moyenne |
| 🟡 vitesse_oiseau | < 32 s | ~40 s | 🔴 Demande d'être 20% plus rapide |
| 🟡 vitesse_eclair | < 22 s | ~40 s | 🔴 Demande d'être 45% plus rapide |
| 💎 vitesse_tornade | < 12 s | ~40 s | 🔴🔴 Presque impossible |

**Problème majeur :** Les badges Bois et Pierre (vitesse_tortue et vitesse_renard) sont **donnés quasi automatiquement** au premier défi — ce n'est pas une récompense méritée. À l'inverse, vitesse_tornade est inatteignable dans des conditions normales.

### 3.3 Impact catastrophique sur `amelioration_etoile`

```typescript
// Condition actuelle : ratio < 0.20
// ratio = elapsedMs / estimatedDurationMs
// Niveau 1 : estimé = 105s, réel moyen = 10s → ratio moyen = 10/105 = 9.5%
// → Presque TOUS les joueurs sont déjà sous 20% !
// → Ce badge est obtenu par défaut dès la première victoire rapide
```

**Ce badge est l'inverse du problème décrit dans la version 2.0 :** ce n'est pas qu'il est impossible, c'est qu'il est TROP FACILE. Pratiquement tout le monde l'obtient sans effort dès le niveau 1.

### 3.4 Refonte recommandée des seuils de vitesse

**Solution :** Utiliser des **ratios relatifs** au `estimatedDuration` du défi, ce qui est automatiquement calibré pour chaque niveau :

```typescript
// NOUVEAUX SEUILS (badgeEngine.ts) — ratio = elapsedMs / estimatedDurationMs
// Calibrés sur les temps réels (ratio moyen ~11-14%)

if (ratio < 0.40) award('vitesse_tortue');   // < 40% estimé → ~bonne performance
if (ratio < 0.25) award('vitesse_renard');   // < 25% estimé → performant
if (ratio < 0.15) award('vitesse_oiseau');   // < 15% estimé → très rapide (proche de la moyenne)
if (ratio < 0.10) award('vitesse_eclair');   // < 10% estimé → excellent
if (ratio < 0.06) award('vitesse_tornade');  // < 6% estimé  → exceptionnel

// Badge amelioration_etoile — réservé aux records absolus
if (ratio < 0.06 && ctx.failCount === 0) award('amelioration_etoile'); // Même seuil que tornade mais SANS erreur
```

**Traduction en secondes pour le joueur (descriptions à mettre à jour) :**

| Badge | Niv 1 (estimé 105s) | Niv 5 (estimé 390s) | Niv 13 (estimé 750s) |
|-------|--------------------|--------------------|---------------------|
| 🟤 tortue (< 40%) | < 42 s | < 156 s | < 300 s |
| ⚪ renard (< 25%) | < 26 s | < 97 s | < 187 s |
| 🟡 oiseau (< 15%) | < 16 s | < 58 s | < 112 s |
| 🟡 éclair (< 10%) | < 10 s | < 39 s | < 75 s |
| 💎 tornade (< 6%) | < 6 s | < 23 s | < 45 s |

> **Pour l'affichage joueur :** ne pas montrer le ratio, mais le temps cible calculé dynamiquement à partir de l'`estimatedDuration` du défi courant. Ex : "Objectif : moins de 10s sur ce défi"

### 3.5 Impact sur la durée d'un niveau

Un niveau = 10 défis. Temps total pour un joueur moyen :

| Niveau | Temps réel moyen/défi | Temps total niveau | Cumul depuis niv 1 |
|--------|-----------------------|-------------------|--------------------|
| 1 | ~10 s | ~1 min 40 s | ~1 min 40 s |
| 2 | ~20 s | ~3 min 20 s | ~5 min |
| 3 | ~30 s | ~5 min | ~10 min |
| 5 | ~40 s | ~6 min 40 s | ~23 min |
| 8 | ~55 s | ~9 min 10 s | ~48 min |
| 13 | ~90 s | ~15 min | ~2h30 |

**→ Un joueur peut compléter les 13 niveaux en environ 2h30 de jeu au total.**  
**→ Un niveau peut se faire en moins de 5 minutes (confirmé) dès les premiers niveaux.**  
**→ La valeur `estimatedDuration` ne doit PAS être affichée telle quelle au joueur — utiliser plutôt le temps cible calculé.**

---

## 4. Le mécanisme noErrorStreak — Attention !

### 4.1 Comment fonctionne exactement le streak de précision

```typescript
// Flux complet :

// 1. Le joueur appuie sur "Valider" et se trompe
//    → [challengeId].tsx détecte validationResult.status === 'failure'
//    → Appelle player.recordChallengeFailure(challengeId)

// 2. recordChallengeFailure() dans playerStore.ts :
recordChallengeFailure: (challengeId) => {
  set(state => ({
    stats: {
      ...state.stats,
      noErrorStreak: 0,  // ← RESET IMMÉDIAT à zéro
      failCount: { ... }
    }
  }));
}

// 3. Quand le joueur réussit enfin :
//    markChallengeCompleted() calcule :
const hadFailures  = errorCount > 0;
const newNoErrorStreak = hadFailures ? 0 : state.stats.noErrorStreak + 1;
// → si errorCount > 0 : streak = 0
// → si errorCount = 0 : streak += 1
```

### 4.2 Ce que cela signifie pour le joueur

> ⚠️ **Point crucial pour la communication au joueur :** Appuyer sur "Valider" alors que le plateau est incomplet ou faux **réinitialise immédiatement le streak de précision à zéro**, même si le joueur réussit ensuite dans la même partie.

| Action joueur | Conséquence sur noErrorStreak |
|--------------|------------------------------|
| Valide avec une case vide → échec → puis réussit | Streak = 0 (reset à l'échec) |
| Valide directement la bonne solution | Streak += 1 |
| Ne jamais appuyer "Valider" sauf au bon moment | Streak += 1 |
| Appuie 3 fois sur Valider avant de réussir | Streak = 0 |

### 4.3 Problème de perception pour le public familial

**Situation fréquente chez un enfant :**
1. Il place tous les jetons
2. Il appuie sur Valider pour "voir si c'est bon" (comportement naturel d'exploration)
3. Ce n'est pas bon → il corrige
4. Il appuie à nouveau sur Valider → succès
5. **Résultat : streak = 0**, l'enfant ne comprend pas pourquoi

**Solutions possibles :**

**Option A (recommandée) :** Afficher un avertissement visuel avant le premier appui sur Valider :
> "⚠️ Valider va tester ta solution. Une erreur réinitialisera ta série de précision !"

**Option B :** Créer un mode "vérification gratuite" (1 par défi) qui n'impacte pas le streak

**Option C :** Ne compter le streak que sur la validation finale réussie, pas sur les tentatives intermédiaires. (Changement de logique profond — déconseillé car retire de l'enjeu)

**Option D :** Distinguer `noErrorStreak` (précision parfaite) d'un `completionStreak` (défis complétés, peu importe les erreurs) — le completionStreak alimente les badges de régularité, le noErrorStreak alimente les badges de précision.

### 4.4 Recommandation

Garder la logique actuelle (rigoureuse et juste) mais **la communiquer clairement** :
- Ajouter un indicateur visuel du streak en cours dans le header de jeu
- Montrer un emoji de flamme 🔥 si noErrorStreak > 0 avec le nombre de défis parfaits
- Quand le streak est brisé : animation spéciale + message "Série de précision interrompue : recommence !"
- Reformuler les descriptions des badges de précision en langage simple : **"Valide du premier coup sans jamais te tromper"**

---

## 5. Graines seules suffisent-elles ? Graines vs XP

### 5.1 Analyse du besoin

Le jeu a actuellement **deux métriques de progression** :
- `seeds` : monnaie dépensable (bonus, Clairière)
- `currentLevel` : niveau du joueur (1–15, basé sur completedChallenges.length ÷ 3)

La question est : faut-il une **troisième métrique XP** séparée ?

### 5.2 Problème fondamental des graines seules

```
Scénario problème :
  → Le joueur a 500 graines
  → Il achète 20 items dans la Clairière
  → Il se retrouve à 0 graine
  → Sur son profil, il affiche 0 graines → semble "pauvre"
  → Sentiment de régression malgré une vraie progression

Autre problème :
  → Les graines peuvent être DÉPENSÉES = elles n'indiquent pas la progression totale
  → Un joueur dépensier semble moins avancé qu'un joueur économe
  → Le classement basé en partie sur les graines (leaderboard) est faussé
```

### 5.3 Comparaison des modèles

| Jeu | Système | Résultat |
|-----|---------|----------|
| Clash Royale | Trophées (jamais perdus définitivement) + Or (dépensable) | ✅ Deux métriques claires |
| Royal Match | Étoiles (progression) + Pièces d'or (dépensables) | ✅ Identité séparée |
| Duolingo | XP (jamais perdu) + Gemmes (dépensables) | ✅ Très lisible |
| Dans la Forêt (actuel) | Graines (dépensables, niveau basé sur défis) | ⚠️ Mélange confus |

### 5.4 Recommandation : Graines + Titre de Rang

**Ne pas ajouter un compteur XP classique** (trop complexe pour public familial). À la place :

```
Système recommandé :

  🌱 GRAINES (dépensables)
  → Gagnées à chaque victoire + badges + missions
  → Dépensées dans la Clairière et pour les bonus
  → Affichées sur le profil et dans le header

  🏅 RANG FORÊT (permanent, jamais réduit)
  → Basé sur : défis complétés + badges obtenus + missions
  → 8 rangs symboliques : Gland → Graine → Pousse → Arbuste
                         → Arbre → Chêne → Forêt → Esprit
  → Affiché à côté du nom du joueur (partout)
  → VISIBLE dans le classement mondial
  → Ne dépend PAS des graines dépensées

  Formule de Rang :
  rangPoints = (completedChallenges × 10) + (badges × 25) + (missionsCompleted × 5) + (dailyStreak × 2)
```

### 5.5 Les 8 Rangs de la Forêt

| Rang | Emoji | Nom | Points requis | Description |
|------|-------|-----|--------------|-------------|
| 1 | 🌰 | Gland | 0 | Tu viens d'arriver dans la forêt |
| 2 | 🌱 | Graine | 100 | Tes premières racines poussent |
| 3 | 🌿 | Pousse | 300 | Tu commences à t'épanouir |
| 4 | 🪴 | Arbuste | 700 | La forêt te reconnaît |
| 5 | 🌳 | Arbre | 1 500 | Tu fais partie des bois |
| 6 | 🌲 | Chêne | 3 000 | Un habitué respecté |
| 7 | 🌲🌲 | Grande Forêt | 6 000 | Un gardien de la forêt |
| 8 | ✨ | Esprit de la Forêt | 12 000 | La légende vivante |

**Avantages du Rang :**
- Affiché à côté du pseudo (comme les arènes dans Clash Royale)
- Visible dans le classement mondial
- Ne diminue jamais (contrairement aux graines)
- Donne un sentiment de progression même quand on dépense des graines
- Les amis voient ton rang dans le mode défi

### 5.6 Modification du classement

Remplacer le `score` actuel du leaderboard :
```typescript
// AVANT :
score = level * 10_000_000 + badgeCount * 10_000 + seeds
// Problème : seeds dépendantes des dépenses

// APRÈS :
rangPoints = (completedCount * 10) + (badgeCount * 25) + (missionsCompleted * 5) + (dailyStreak * 2)
// Jamais réduit, reflète l'engagement total
```

---

## 6. Les Défis Journaliers — Spécification complète

> ⚠️ **Statut actuel :** Référencé dans le système (RARITY_UNLOCKS `defi_journalier`, stats `topDEJCount`, badge `social_trophee`) mais **0% implémenté**. Aucun écran, aucun service, aucune Cloud Function.

### 6.1 Concept

Chaque jour à minuit (heure locale du serveur), **un nouveau défi du jour est sélectionné** et soumis à tous les joueurs. C'est le même défi pour tout le monde. Les joueurs ont 24h pour le compléter. Un classement quotidien récompense les 3 meilleurs temps.

### 6.2 Règles du défi journalier

- **Aucun bonus autorisé** (comme le mode défi ami) — pureté totale
- **Un seul essai** : si tu valides et que c'est faux, cela compte comme tentative ratée mais tu peux réessayer
- **Temps enregistré** : le premier temps validé avec succès est ton score définitif
- **Visible par tous** : le classement du jour est public
- **Déblocage** : disponible pour tous (gratuit), débloqué après 9 badges Bois selon le système actuel — **à revoir : rendre gratuit dès le départ**

### 6.3 Sélection du défi du jour

```typescript
// Algorithme de sélection (Cloud Function Firestore, déclenchée chaque minuit UTC)
// 1. Calculer le hash du jour : SHA256("dlf_" + YYYY-MM-DD) % totalChallenges
// 2. Sélectionner le défi correspondant dans le pool
// 3. Varier le niveau (semaine 1 = niveau 1-3, semaine 2 = niveau 2-5, etc.)
// 4. Stocker dans /dailyChallenge/{YYYY-MM-DD} : { challengeId, levelId, date }

interface DailyChallenge {
  date: string;           // "YYYY-MM-DD"
  challengeId: string;    // ex: "niveau_3_007"
  levelId: string;        // ex: "niveau_3"
  levelNumber: number;    // 3
}
```

### 6.4 Enregistrement des scores

```typescript
// Collection : /dailyLeaderboard/{YYYY-MM-DD}/scores/{userId}
interface DailyScore {
  userId: string;
  username: string;
  timeMs: number;
  completedAt: Timestamp;
  rank?: number;          // Calculé côté client à l'affichage
}
```

### 6.5 Récompenses du défi journalier

| Performance | Récompense |
|------------|------------|
| Participé (complété dans les 24h) | +5 🌱 + points de rang |
| Top 10 | +10 🌱 supplémentaires |
| Top 3 | +20 🌱 + badge temporaire "⭐ Top 3 du jour" |
| #1 | +35 🌱 + badge temporaire "🏆 Champion du jour" |
| 5 fois top 3 | Badge permanent `social_trophee` 💎 Cristal |

### 6.6 Écran Défi Journalier

```
╔══════════════════════════════════════════════════════════╗
║  📅 DÉFI DU JOUR — Vendredi 15 mars                     ║
║  ⏱ Il reste 14h 23min                                   ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  🏆 Classement du jour                                   ║
║  1. 🥇 ForêtMaster    — 00:08.3                         ║
║  2. 🥈 PetitLoup      — 00:09.1                         ║
║  3. 🥉 OursGeant      — 00:11.4                         ║
║  ...                                                     ║
║  42. Toi (?)          — Pas encore joué                  ║
║                                                          ║
║  [ 🎯 Jouer le défi du jour ]                           ║
║                                                          ║
║  Récompense : +5🌱 à +35🌱 selon classement             ║
╚══════════════════════════════════════════════════════════╝
```

### 6.7 Architecture technique — Nouveaux fichiers nécessaires

```
src/services/dailyChallengeService.ts   — CRUD Firestore défi du jour
src/store/dailyChallengeStore.ts        — État Zustand (score, classement)
app/(tabs)/daily.tsx                    — Écran défi journalier
```

### 6.8 Intégration dans les badges existants

- `social_trophee` (Cristal) : 5 fois dans le top 3 → déjà prévu, il suffit d'implémenter `recordTopDEJ()`
- Nouveau badge `defi_journalier_first` (Bois) : Participe à ton premier défi du jour
- Nouveau badge `defi_journalier_semaine` (Pierre) : Participe 7 jours de suite au défi du jour

---

## 7. Modèle Freemium — Gratuit vs Premium 2,99€

> Prix retenu : **2,99 €** (achat unique, pas d'abonnement)

### 7.1 Philosophie

> **"Gratuit doit être FUN. Premium doit être PLUS."**
> Le jeu gratuit doit être complet et satisfaisant. Le premium n'achète pas d'avantage compétitif — il achète du contenu supplémentaire et du confort.

### 7.2 Contenu GRATUIT 🆓

| Contenu | Détail |
|---------|--------|
| **Niveaux 1 à 5** | 50 défis solo complets |
| **Tous les badges** | Accessibles aux niveaux 1-5 (vitesse, précision, régularité, secrets) |
| **Clairière basique** | ~15 items disponibles (cabane, mouton, jeune pousse, feu de camp, ruche) |
| **Défi journalier** | Accès complet + classement |
| **Classement mondial** | Lecture seule |
| **Missions quotidiennes** | 3 missions par jour |
| **Badges saisonniers** | Tous les 4 |
| **Badges secrets** | Tous les 5 |
| **Streak quotidien** | Complet avec récompenses |
| **2 bonus de base** | Cases valides (3🌱) + Compter erreurs (2🌱) |
| **Profil + vitrine 3 badges** | Complet |

### 7.3 Contenu PREMIUM 💎 — 2,99€

| Contenu | Détail | Justification |
|---------|--------|--------------|
| **Niveaux 6 à 13** | 80 défis supplémentaires | Cœur de la valeur |
| **Mode Défi entre amis** | Défier ses amis en 1v1 | Contenu social avancé |
| **2 bonus avancés** | Instinct (8🌱) + Flash (12🌱) | Aide supplémentaire |
| **Clairière complète** | Tous les items débloquables | 30+ items exclusifs |
| **Thème Forêt Féerique ✨** | Fond exclusif (500🌱) | Cosmétique premium |
| **Multiplicateur graines ×1.5** | Sur toutes les victoires | Progression plus rapide |
| **Historique badges détaillé** | Dates + contexte d'obtention | QoL |
| **Avatar animé** | L'Esprit de la Forêt comme avatar | Cosmétique exclusif |

### 7.4 Ce que le Premium ne donne PAS

- ❌ Pas d'avantage sur le classement (juste plus de contenu)
- ❌ Pas de badges exclusifs premium (l'accès aux niveaux 6-13 donne accès à plus de badges, mais tous les badges existent pour les deux)
- ❌ Pas de "pay to win" — le défi ami est équitable car basé sur le temps

### 7.5 Valeur perçue à 2,99€

```
Pour 2,99€, le joueur reçoit :
  → 80 défis supplémentaires (soit ~2h de contenu pour un joueur normal)
  → La Clairière complète (30+ items vs 15 gratuits)
  → Le mode défi ami (contenu social)
  → 2 bonus avancés
  → ×1.5 sur les graines

Comparaison marché :
  → Alto's Odyssey : 5,99€
  → Monument Valley : 4,99€
  → Wordle (NYT) : 0€ (mais pub)
  → 2,99€ = juste prix pour un jeu familial qualitatif
```

### 7.6 Implémentation technique

```typescript
// Dans playerStore.ts, isPremium conditionne :
// - L'accès aux niveaux 6+
// - L'affichage du bouton "Défi ami"
// - Les bonus instinct + flash dans HintOverlay
// - Les items Clairière premium
// - Le multiplicateur de graines : seedsEarned * (isPremium ? 1.5 : 1)

// Prix à corriger dans profile.tsx :
// AVANT : "Débloquer — 3,99 €"
// APRÈS : "Débloquer — 2,99 €"
```

---

## 8. Catalogue des 41 badges — analyse critique

### 8.1 Distribution actuelle par rareté

| Rareté | Nombre | Graines/badge | Total max graines |
|--------|--------|--------------|-------------------|
| 🟤 Bois | 9 | 5 🌱 | 45 🌱 |
| ⚪ Pierre | 14 | 15 🌱 | 210 🌱 |
| 🟡 Or | 12 | 30 🌱 | 360 🌱 |
| 💎 Cristal | 6 | 75 🌱 | 450 🌱 |
| **TOTAL** | **41** | — | **1 065 🌱** |

### 8.2 Analyse des seuils de progression

| Badge | Seuil actuel | Évaluation |
|-------|-------------|------------|
| precision_oeil | 3 défis consécutifs sans erreur | ✅ Accessible |
| precision_hibou | 10 défis | ✅ Accessible |
| precision_arc | 25 défis | ⚠️ Long mais faisable |
| precision_couronne | 50 défis | ❌ Trop long, décourageant |
| regularite_arbre | 30 jours de suite | ⚠️ Ambitieux mais motivant |
| regularite_foret | 100 jours de suite | ❌ Trop long pour public familial |
| social_roi | 50 victoires amis | ❌ Irréaliste si peu d'amis |
| amelioration_etoile | < 20% temps estimé | ❌ Quasi impossible |
| exploration_collectionneur | 50 défis | ✅ Atteignable (5 niveaux) |

### 8.3 Problèmes de cohérence thématique

- `precision_couronne` et `social_roi` partagent le même emoji 👑 → confusant
- `exploration_graine` et `precision_pousse` partagent l'emoji 🌱 → confusant
- `exploration_cible` et `precision_oeil` partagent l'emoji 🎯 → confusant
- Le badge `💀 Maître des profondeurs` (cristal) utilise un emoji trop sombre pour un public familial
- `exploration_crane` (💀) est thématiquement incohérent avec l'univers forêt

---

---

## 9. Économie des graines — état actuel et problèmes

### 9.1 Sources de graines (revenus)

| Source | Graines | Fréquence |
|--------|---------|-----------|
| Badge Bois | 5 🌱 | Rare (9 max total) |
| Badge Pierre | 15 🌱 | Commun (14 max total) |
| Badge Or | 30 🌱 | Peu fréquent (12 max total) |
| Badge Cristal | 75 🌱 | Très rare (6 max total) |
| Victoire (calculSeedReward) | 1–10 🌱 estimé | Chaque défi |
| Victoire défi ami | 15 🌱 | Occasionnel |
| Palier bois 7 | +50 🌱 | Une fois |
| Palier bois 3 | +10 🌱 | Une fois |

**Total badges seuls (si tous obtenus) : 1 065 🌱**

### 9.2 Dépenses de graines (coûts bonus)

| Bonus | Coût | Requis unlock |
|-------|------|---------------|
| Cases valides | 3 🌱 | Non |
| Compter erreurs | 2 🌱 | Non |
| Instinct | 6 🌱 | Oui (3 badges Or) |
| Flash | 8 🌱 | Oui (5 badges Pierre) |

### 9.3 Problèmes d'équilibre identifiés

1. **Trop de graines, pas assez de dépenses** : 1 065 graines potentielles vs 4 bonus qui coûtent 2–8 graines → l'argent ne sert presque à rien
2. **Pas de boutique visible** : le joueur accumule des graines sans savoir clairement ce qu'il peut acheter
3. **Les bonus coûtent peu** → le challenge de conserver des graines est nul
4. **Aucun déblocage permanent payant** → les graines ne servent qu'aux bonus temporaires
5. **Le ratio récompense/effort est incohérent** : 75 graines pour un cristal (extraordinaire) vs 8 graines pour le bonus Flash (banal)

---

---

## 10. Analyse gamification — Points forts & faibles

### 10.1 ✅ Points forts

#### Architecture solide
- Évaluateur de badges **pur et idempotent** : impossible de recevoir un badge en double
- **Sync Firestore atomique** avec `arrayUnion` : robuste hors-ligne
- **Progression visible** dans la VictoryModal après chaque victoire
- **Toasts animés** avec feux d'artifice : récompense émotionnellement satisfaisante
- **File de toasts** : si plusieurs badges simultanés, ils s'affichent en séquence
- Système de **rareté à 4 niveaux** : crée une hiérarchie claire de valeur

#### Diversité des conditions
- 8 catégories de badges couvrant : vitesse, précision, régularité, social, amélioration, exploration, secrets, saisonniers
- Les **badges secrets** créent de la surprise et du mystère (très bon mécanisme)
- Les **badges saisonniers** donnent une raison de revenir à des moments précis de l'année

#### Système de déblocage par paliers
- Les paliers RARITY_UNLOCKS lient les badges à des **récompenses concrètes** (bonus, thèmes)
- Crée une **progression méta** au-delà des niveaux

### 10.2 ❌ Points faibles

#### Lisibilité pour un public familial
- **La condition de certains badges est trop technique** : "Termine en moins de 20% du temps estimé" → un enfant de 8 ans ne comprend pas
- **Les seuils de vitesse relatifs** (par rapport au niveau) ne sont pas expliqués dans les descriptions qui citent des secondes fixes
- **Pas de tutoriel badges** : à quoi ça sert ? Comment ça marche ? Ce n'est nulle part expliqué
- Les badges **régularité de nuit** (22h-6h) sont inadaptés à un public familial — jouer à 23h30 est peu probable pour un enfant

#### Manque de sens et de but
- **Pourquoi collecter des badges ?** → Pas de réponse claire visible in-game
- **La vitrine 3 badges** existe mais n'est accessible que dans le mode défi amis → peu mise en avant
- **Pas de "quête active"** : le joueur ne sait pas quel badge viser maintenant

#### Progression trop longue
- `regularite_foret` (100 jours) → irréaliste pour un public familial
- `precision_couronne` (50 défis d'affilée sans erreur) → frustrant
- `social_roi` (50 victoires amis) → suppose un réseau social dense

#### Économie incohérente
- On accumule des graines sans savoir quoi en faire
- Pas de boutique, pas de nouveaux items à acheter, pas de personnalisation payante

---

---

## 11. Comparaison avec les meilleurs jeux

### 11.1 Clash Royale — Ce qu'on peut s'inspirer

| Mécanique CR | Application Dans la Forêt |
|-------------|--------------------------|
| **Coffres à ouvrir après victoire** | Badge "à gratter" après chaque niveau complété |
| **Progression visible : arène 1→14** | Progression de badge : Bois → Pierre → Or → Cristal comme "ligue" |
| **Défis spéciaux limités dans le temps** | Défis saisonniers avec badges exclusifs (déjà partiellement présent) |
| **Trophées = monnaie de classement** | Les graines = trophées → elles servent aussi à progresser dans le classement |
| **Vitrine du profil joueur** | La Clairière → personnalisation visible par les amis |
| **Missions quotidiennes** | "Défi du jour" → complète X défis aujourd'hui pour +bonus |
| **Pass Saison** | Premium passe de X semaines avec récompenses exclusives |

### 11.2 Royal Match — Ce qu'on peut s'inspirer

| Mécanique RM | Application Dans la Forêt |
|-------------|--------------------------|
| **Construire son château** | 🏡 **La Clairière** : construire sa maison, planter des arbres, adopter des animaux |
| **Chaque victoire = pièce du puzzle** | Chaque défi complété = ressource pour améliorer la Clairière |
| **Personnages qui réagissent** | Les animaux de la forêt (ours, mouton, cerf...) qui habitent votre Clairière |
| **Niveaux étoiles (1-3 étoiles)** | Étoiles selon la vitesse + précision → 1, 2 ou 3 étoiles par défi |
| **Boutique d'items cosmétiques** | Shop "Clairière" avec décorations achetables en graines |
| **Événements limités** | Weekend spécial avec x2 graines ou badges bonus |
| **Récompenses visuelles immédiates** | L'animation de construction dans la Clairière après chaque achat |

### 11.3 Duolingo — Ce qu'on peut s'inspirer

| Mécanique Duo | Application Dans la Forêt |
|-------------|--------------------------|
| **Streak de feu quotidien** | Streak quotidien déjà présent → le rendre plus **visuel et central** |
| **Ligues hebdomadaires** | Top 10 hebdomadaire avec badges exclusifs |
| **Cœurs (vies)** | Optionnel : mode "défi sans erreur" avec vies limitées |
| **Badges de ligue** | Badges de ligue : "Ligue Bouleau", "Ligue Chêne", "Ligue Séquoia" |
| **Récompense "Légendaire"** | Badge Légendaire hebdomadaire pour le #1 de la ligue |

---

---

## 12. Plan d'amélioration en 4 phases

### Phase 1 — Correctifs immédiats (priorité haute)
> **Durée estimée : 2–3 jours**

- [ ] **Fix 1.1** : Refonte des seuils de vitesse → passer en mode ratio (voir §3.4)
- [ ] **Fix 1.2** : Corriger `amelioration_etoile` (seuil 6% + sans erreur, voir §3.3)
- [ ] **Fix 1.3** : Ajouter `amelioration_fusee` dans `evaluateBadges()` (badge actuellement inattribuable)
- [ ] **Fix 1.4** : Ajouter `improvedChallengesCount` dans `GameContext` de badgeEngine
- [ ] **Fix 1.5** : Stocker `earnedAt: Record<string, string>` dans playerStore + Firestore
- [ ] **Fix 1.6** : Appeler `recordFriendInvited()` dans le flux d'invitation ami
- [ ] **Fix 1.7** : Remplacer emoji 💀 par 🌿 pour `exploration_crane` (cohérence thématique)
- [ ] **Fix 1.8** : Dédupliquer les emojis : precision_couronne → 🌟 / social_roi → 🦌
- [ ] **Fix 1.9** : Corriger le prix affiché dans profile.tsx : 3,99€ → 2,99€
- [ ] **Fix 1.10** : Afficher l'indicateur de streak de précision 🔥 dans le header de jeu

### Phase 2 — Rang Forêt + UX badges (priorité haute)
> **Durée estimée : 3–4 jours**

- [ ] **UX 2.1** : Implémenter le **système de Rang Forêt** (8 rangs, voir §5.5)
- [ ] **UX 2.2** : Afficher le rang à côté du pseudo partout (profil, classement, défi ami)
- [ ] **UX 2.3** : Remplacer le score du leaderboard par les points de rang (voir §5.6)
- [ ] **UX 2.4** : Ajouter un **écran "Mes Objectifs"** : 3 badges actifs avec progression
- [ ] **UX 2.5** : Rendre la **vitrine badges** accessible depuis l'écran d'accueil
- [ ] **UX 2.6** : Ajouter un **tooltip explicatif** au premier accès badges
- [ ] **UX 2.7** : Ajouter le **système d'étoiles** (1–3 étoiles par défi) sur l'écran niveaux
- [ ] **UX 2.8** : Afficher dans VictoryModal : Rang actuel + points gagnés + progression vers prochain rang
- [ ] **UX 2.9** : Ajouter indicateur noErrorStreak 🔥 visible dans le header de jeu

### Phase 3 — Défis Journaliers + La Clairière
> **Durée estimée : 7–10 jours**  
> **Voir §6 pour les défis journaliers, §13 pour la Clairière**

- [ ] Implémenter les Défis Journaliers (voir §6 — tout à créer)
- [ ] Nouvel écran "Clairière" (onglet dans la navigation principale)
- [ ] Système d'items (maison, arbres, animaux) achetables avec des graines
- [ ] Lien badges ↔ déblocages visuels dans la Clairière
- [ ] Persistance Firestore de l'état de la Clairière
- [ ] Implémenter le multiplicateur graines ×1.5 pour les Premium

### Phase 4 — Nouveaux badges + rééquilibrage (priorité normale)
> **Durée estimée : 2–3 jours**  
> **Voir §15 pour le nouveau catalogue**

- [ ] Ajouter 8 nouveaux badges liés à la Clairière
- [ ] Rééquilibrer les seuils des badges trop difficiles
- [ ] Introduire les badges de "ligue hebdomadaire"
- [ ] Introduire les "missions quotidiennes" (3 missions simples par jour)

---

---

## 13. La Clairière — Spécifications détaillées

> 💡 **Concept** : Chaque joueur possède une Clairière — une petite parcelle de forêt visible sur un fond du jeu. Il y plante des arbres, construit une maison, adopte des animaux de la forêt. La Clairière est **visible par les amis** lors des défis. C'est l'identité visuelle du joueur, son "château" (comme dans Royal Match).

### 13.1 Concept visuel

```
╔══════════════════════════════════════════════════════════╗
║  🌲  🌲        🏡 Ma Clairière        🌲  🌲           ║
║                                                          ║
║       🌳          🏠                                    ║
║               🐑        🦊                              ║
║    🌿  🌿                   🌸  🌸                     ║
║                   🐻                                     ║
║  🌱              🌱    🌱          🌱                   ║
║                                                          ║
║  [ Ma Clairière ]  Niveau 3 — 12 items                  ║
╚══════════════════════════════════════════════════════════╝
```

L'image de fond utilise le même style graphique que les puzzles (forêt enchantée). Les items sont des emojis/sprites positionnés sur la scène.

### 13.2 Catégories d'items

#### 🏡 Habitations
| Item | Coût | Déblocage |
|------|------|-----------|
| Petite cabane en bois | Gratuit (départ) | Offert au début |
| Chalet de montagne | 50 🌱 | Niveau 3+ |
| Maison forestière | 120 🌱 | Niveau 6+ |
| Manoir de la forêt | 300 🌱 | Niveau 10+ |
| Tour de guet | 180 🌱 | Badge "Gardien de la forêt" |

#### 🌳 Végétation
| Item | Coût | Déblocage |
|------|------|-----------|
| Jeune pousse 🌱 | 5 🌱 | Dès le début |
| Arbuste fleuri 🌿 | 15 🌱 | Niveau 2+ |
| Chêne adulte 🌳 | 40 🌱 | Niveau 4+ |
| Cerisier en fleur 🌸 | 60 🌱 | Saison printemps |
| Sapin enneigé ❄️ | 60 🌱 | Saison hiver |
| Érable d'automne 🍂 | 60 🌱 | Saison automne |
| Séquoia géant 🌲 | 200 🌱 | Badge "Gardien de la forêt" (100j streak) |

#### 🐾 Animaux adoptables
| Item | Coût | Déblocage |
|------|------|-----------|
| Mouton 🐑 | 25 🌱 | Dès le début |
| Renard 🦊 | 40 🌱 | Niveau 4+ |
| Ours brun 🐻 | 60 🌱 | Niveau 7+ |
| Cerf 🦌 | 80 🌱 | Badge "Vieux Chêne" (niveaux 1-9) |
| Biche 🦌 | 80 🌱 | Badge "Vieux Chêne" (niveaux 1-9) |
| Chien de berger 🐕 | 35 🌱 | Niveau 3+ |
| Chouette 🦉 | 50 🌱 | Badge "Sagesse du hibou" |
| Renard arctique 🦊 | 90 🌱 | Thème Hiver débloqué |
| Esprit de la forêt 🌿 | Gratuit | Badge "Gardien de la forêt" (100j streak) |

#### 🎨 Décorations
| Item | Coût | Déblocage |
|------|------|-----------|
| Feu de camp 🔥 | 20 🌱 | Dès le début |
| Ruche 🍯 | 30 🌱 | Niveau 2+ |
| Tas de bûches 🪵 | 15 🌱 | Niveau 5+ |
| Cascade 💧 | 80 🌱 | Niveau 8+ |
| Arc-en-ciel 🌈 | 100 🌱 | Saison printemps |
| Igloo ⛺ | 70 🌱 | Saison hiver |
| Champignons magiques 🍄 | 45 🌱 | Badge "Le Fantôme" (secret) |
| Étoile filante ⭐ | 150 🌱 | Badge "Record du Monde" |

#### 🎭 Thèmes de fond
| Thème | Coût | Déblocage |
|-------|------|-----------|
| Forêt ensoleillée | Gratuit | Départ |
| Forêt d'automne 🍂 | Via palier | 3 badges Pierre |
| Forêt enneigée ❄️ | Via palier | 9 badges Pierre |
| Forêt mystique 🌙 | Via palier | 7 badges Or |
| Forêt féerique ✨ | 500 🌱 | Tous les niveaux complétés |

### 13.3 Structure Firestore — Clairière

```typescript
// Champ additionnel dans /players/{userId}
interface ClairiereState {
  clairiere: {
    items: ClairiereItem[];       // Items placés dans la scène
    lastUpdated: Timestamp;
  }
}

interface ClairiereItem {
  itemId: string;          // ex: "chalet", "ours", "feu_camp"
  positionX: number;       // 0–100 (pourcentage de la largeur)
  positionY: number;       // 0–100 (pourcentage de la hauteur)
  purchasedAt: Timestamp;
}
```

### 13.4 Lien badges ↔ Clairière

Certains badges **débloquent automatiquement** un item dans la Clairière (en plus des graines) :

| Badge obtenu | Item débloqué dans la Clairière |
|-------------|----------------------------------|
| `regularite_aube` (3j streak) | Feu de camp 🔥 offert |
| `precision_hibou` (10 parfaits) | Chouette 🦉 offerte |
| `exploration_chene` (niveaux 1-9) | Cerf + Biche offerts |
| `regularite_foret` (100j streak) | Séquoia géant + Esprit de la forêt |
| `record_mondial` | Étoile filante ⭐ offerte |
| `secret_fantome` | Champignons magiques offerts |
| `saisonnier_printemps` | Cerisier en fleur offert |
| `saisonnier_hiver` | Sapin enneigé offert |

### 13.5 Interactions dans la Clairière

- **Les animaux bougent** légèrement (animation subtile) pour indiquer qu'ils sont "vivants"
- **Tap sur un animal** → petit dialogue contextuel ("Le renard est content ! 🦊")
- **Tap sur la maison** → voir les stats du joueur (level, badges, streak)
- **Animation de placement** : quand on achète un item, il "tombe du ciel" dans la scène
- **Partager** : bouton pour partager une capture de sa Clairière

---

---

## 14. Nouvelle économie équilibrée

### 14.1 Nouveaux revenus (sources de graines)

| Source | Graines | Fréquence | Note |
|--------|---------|-----------|------|
| Premier défi complété (daily) | +3 🌱 | 1/jour | Encourage le retour quotidien |
| Victoire normale | 1–8 🌱 | Par défi | Calculé selon temps + précision |
| Victoire parfaite (0 erreur) | +3 🌱 bonus | Aléatoire | Récompense la précision |
| Victoire défi ami | +15 🌱 | Occasionnel | Inchangé |
| Badge Bois | +8 🌱 | 9 max | Augmenté (était 5) |
| Badge Pierre | +20 🌱 | 14 max | Augmenté (était 15) |
| Badge Or | +40 🌱 | 12 max | Augmenté (était 30) |
| Badge Cristal | +100 🌱 | 6 max | Augmenté (était 75) |
| Palier Bois ×3 | +15 🌱 | 1 fois | Augmenté (était 10) |
| Palier Bois ×6 | Mode Zen | 1 fois | Inchangé |
| Palier Pierre ×7 | +75 🌱 | 1 fois | Augmenté (était 50) |
| Mission quotidienne ×1 | +5 🌱 | 1/jour | **NOUVEAU** |
| Mission quotidienne ×2 | +8 🌱 | 1/jour | **NOUVEAU** |
| Mission quotidienne ×3 | +12 🌱 | 1/jour | **NOUVEAU** |
| Streak 7 jours | +20 🌱 | Hebdo | **NOUVEAU** |
| Streak 30 jours | +100 🌱 | Mensuel | **NOUVEAU** |

**Total badges seuls (nouveau) : ~1 400 🌱**
**Total missions quotidiennes sur 30 jours : ~600 🌱**
**Total streaks sur 30 jours : ~220 🌱**
**→ Budget mensuel d'un joueur actif : ~300–500 🌱**

### 14.2 Nouveaux coûts (dépenses)

| Dépense | Coût | Catégorie |
|---------|------|-----------|
| Bonus "Cases valides" | 3 🌱 | Aide au jeu |
| Bonus "Compter erreurs" | 2 🌱 | Aide au jeu |
| Bonus "Instinct" | 8 🌱 | Aide avancée |
| Bonus "Flash" | 12 🌱 | Aide avancée |
| Jeune pousse 🌱 (Clairière) | 5 🌱 | Cosmétique |
| Mouton 🐑 (Clairière) | 25 🌱 | Cosmétique |
| Feu de camp 🔥 (Clairière) | 20 🌱 | Cosmétique |
| Arbuste 🌿 (Clairière) | 15 🌱 | Cosmétique |
| Renard 🦊 (Clairière) | 40 🌱 | Cosmétique |
| Chalet 🏠 (Clairière) | 50 🌱 | Cosmétique |
| Chêne 🌳 (Clairière) | 40 🌱 | Cosmétique |
| Ours 🐻 (Clairière) | 60 🌱 | Cosmétique |
| Cerf 🦌 (Clairière) | 80 🌱 | Cosmétique |
| Manoir 🏰 (Clairière) | 300 🌱 | Cosmétique |
| Séquoia 🌲 (Clairière) | 200 🌱 | Cosmétique |

**→ Un joueur actif peut remplir une Clairière de base en ~2–3 semaines de jeu**
**→ Une Clairière complète coûte environ 1 500–2 000 🌱**
**→ Equilibre correct : on gagne environ ce qu'on peut dépenser**

### 14.3 Missions quotidiennes (NOUVEAU)

3 missions tirées aléatoirement chaque jour parmi :

| Mission | Récompense |
|---------|-----------|
| Complète 1 défi aujourd'hui | +5 🌱 |
| Complète 3 défis aujourd'hui | +10 🌱 |
| Termine un défi sans erreur | +8 🌱 |
| Bats ton meilleur temps sur un défi | +6 🌱 |
| Joue un défi avant 9h du matin | +5 🌱 |
| Utilise 0 bonus sur un défi | +7 🌱 |
| Complète un défi du niveau X | +8 🌱 |
| Défie un ami | +5 🌱 |

---

---

## 15. Nouveau catalogue de badges enrichi

### 15.1 Badges à corriger (version actuelle)

| Badge actuel | Problème | Correction proposée |
|-------------|----------|---------------------|
| `precision_couronne` (50 parfaits) | Seuil trop élevé | Réduire à 30 défis parfaits |
| `regularite_foret` (100j streak) | Irréaliste | Réduire à 60 jours |
| `regularite_lune` (22h-6h) | Inadapté enfants | Remplacer par "Joue à 3 moments différents de la journée" |
| `regularite_soleil` (6h-9h) | Trop contraignant | Reformuler : "Joue 5 matins d'affilée (avant 12h)" |
| `social_roi` (50 victoires) | Irréaliste | Réduire à 30 victoires |
| `amelioration_etoile` (< 20%) | Trop facile (ratio moyen = 11%) | Changer à < 6% du temps estimé + sans erreur (voir §3.3) |
| `exploration_crane` (💀) | Thème incohérent | Changer en `exploration_esprit` (🌿) |

### 15.2 Nouveaux badges liés à la Clairière (Phase 4)

| ID | Emoji | Label | Condition | Rareté |
|----|-------|-------|-----------|--------|
| `clairiere_germe` | 🌱 | Premier Germe | Place ton premier item dans la Clairière | Bois |
| `clairiere_jardin` | 🌿 | Petit Jardin | Possède 5 items dans ta Clairière | Bois |
| `clairiere_famille` | 🐾 | Famille des bois | Adopte 3 animaux différents | Pierre |
| `clairiere_arbre_genie` | 🌳 | L'Arbre Génie | Plante 5 arbres différents | Pierre |
| `clairiere_festin` | 🔥 | Festin de la forêt | Possède le feu de camp + 3 animaux | Or |
| `clairiere_domaine` | 🏡 | Mon Domaine | Possède 15 items dans ta Clairière | Or |
| `clairiere_paradis` | ✨ | Paradis Sylvestre | Possède 30 items dans ta Clairière | Cristal |
| `clairiere_partage` | 📸 | L'Artiste | Partage ta Clairière avec un ami | Pierre |

### 15.3 Nouveaux badges de progression (Phase 4)

| ID | Emoji | Label | Condition | Rareté |
|----|-------|-------|-----------|--------|
| `mission_10` | 📋 | Explorateur assidu | Complète 10 missions quotidiennes | Bois |
| `mission_30` | 📋 | Habitué | Complète 30 missions quotidiennes | Pierre |
| `mission_100` | 📋 | Légendaire | Complète 100 missions quotidiennes | Or |
| `etoile_10` | ⭐ | Étoilé | Obtiens 30 étoiles en tout | Bois |
| `etoile_parfait` | ⭐ | Perfection | Obtiens 3 étoiles sur 10 défis différents | Pierre |

### 15.4 Nouveaux badges Défis Journaliers (Phase 3)

| ID | Emoji | Label | Condition | Rareté |
|----|-------|-------|-----------|--------|
| `dej_premier` | 📅 | Première séance | Participe à ton premier défi du jour | Bois |
| `dej_semaine` | 🗓️ | Assidu de la forêt | Participe 7 jours de suite au défi du jour | Pierre |
| `dej_podium` | 🥉 | Sur le podium | Entre dans le top 3 du défi du jour (1 fois) | Or |

### 15.5 Nouveaux badges Rang Forêt (Phase 2)

| ID | Emoji | Label | Condition | Rareté |
|----|-------|-------|-----------|--------|
| `rang_arbre` | 🌳 | Arbre de la forêt | Atteins le rang Arbre (1 500 pts) | Pierre |
| `rang_foret` | 🌲 | Grande Forêt | Atteins le rang Grande Forêt (6 000 pts) | Or |
| `rang_esprit` | ✨ | Esprit Légendaire | Atteins le rang Esprit de la Forêt (12 000 pts) | Cristal |

### 15.6 Émojis dédupliqués — table de correction

| Avant | Badge | Après |
|-------|-------|-------|
| 👑 | `precision_couronne` | 🌟 |
| 👑 | `social_roi` | 🦌 |
| 🌱 | `precision_pousse` | 🎯 (garder) |
| 🌱 | `exploration_graine` | 🌱 (garder, différent contexte) |
| 🌿 | `regularite_fougere` | 🌿 (garder) |
| 🌿 | `exploration_herbe` | 🗺️ |
| 🌳 | `regularite_arbre` | 🌳 (garder) |
| 🌳 | `exploration_chene` | 🦌 |
| 💀 | `exploration_crane` | 🌿 (esprit de la forêt) |
| 🎯 | `precision_oeil` | 🎯 (garder) |
| 🎯 | `exploration_cible` | 🛡️ |
| ⭐ | `social_trophee` | 🏆 (garder car unique) |

---

---

## 16. Cohérence de progression — Roadmap joueur

### 16.1 Arc de progression idéal (public familial)

```
JOUR 1-3 : DÉCOUVERTE
━━━━━━━━━━━━━━━━━━━━
🎯 Objectif : obtenir ses 2 premiers badges + Rang 🌱 Graine
• Premier défi complété (~10s) → si < 42s : badge "Patience de la tortue" 🐢 (bois)
• Premier parfait (0 erreur) → badge "Première pousse" 🌱 (bois)
• 3 jours d'affilée → badge "L'Aube du joueur" 🌅 (bois)
• Action : placer 1 item dans la Clairière (gratuit)
• Rang : 🌰 Gland → 🌱 Graine (100 pts, atteint dès le niveau 1)

SEMAINE 1 : ENGAGEMENT
━━━━━━━━━━━━━━━━━━━━━
🎯 Objectif : Rang 🌿 Pousse + remplir sa première Clairière
• Streak 7 jours → badge + +20 graines bonus
• Missions quotidiennes → ~35 graines
• 3 badges Bois atteints → +15 graines palier + Mode Zen
• Défis journaliers quotidiens → +5 à +35🌱/jour
• La Clairière : cabane + 1 arbre + 1 mouton + feu de camp
• Rang : 🌿 Pousse (300 pts) atteint fin de semaine 1

SEMAINE 2-4 : FIDÉLISATION
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Objectif : Rang 🌳 Arbre + badges Pierre + Clairière animée
• Streak 30 jours → badge "Habitué des bois" 🌳 (or) + +100 graines
• 3 badges Pierre → Thème Automne débloqué
• Défis journaliers → premiers top 10 → bonus graines
• La Clairière : chalet + 3 animaux + 5 arbres
• Rang : 🌳 Arbre (1 500 pts) visé fin de mois 1

MOIS 2-6 : PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━
🎯 Objectif : badges Or + Clairière élaborée
• Niveaux 1-9 complétés → badge "Vieux Chêne" 🌳 (or)
• 7 badges Or → Thème Forêt Mystique
• La Clairière : manoir + séquoia + tous les animaux

LONG TERME : MAÎTRISE
━━━━━━━━━━━━━━━━━━━━━
🎯 Objectif : badges Cristal + Clairière de légende
• 60 jours de streak → badge "Gardien de la forêt" 💎
• Record mondial → badge "Record du Monde" 💎
• La Clairière : version ultime avec items exclusifs
```

### 16.2 Système d'étoiles par défi (NOUVEAU)

Chaque défi peut être complété avec 1, 2 ou 3 étoiles :

| Étoiles | Condition | Récompense supplémentaire |
|---------|-----------|--------------------------|
| ⭐ | Défi complété (peu importe le temps/erreurs) | Graines de base |
| ⭐⭐ | Complété sans utiliser plus de 2 bonus | +2 🌱 bonus |
| ⭐⭐⭐ | Complété sans erreur ET ratio < 25% du temps estimé | +5 🌱 bonus + progression badge vitesse |

**Affichage :** Sur l'écran Niveaux, chaque défi affiche ses étoiles (comme Clash Royale ou Royal Match).

### 16.3 "Quête active" permanente (NOUVEAU)

À tout moment, le joueur a **3 objectifs affichés** :
1. **Objectif court** (ce défi) : ex. "Termine ce défi en moins de 45s → badge Ruse du renard"
2. **Objectif moyen** (cette semaine) : ex. "Joue 5 jours de suite → badge Fougère persistante 🌿 (6/7)"
3. **Objectif long** (ce mois) : ex. "Complète les niveaux 1 à 5 → badge Explorateur confirmé (3/5)"

Ces objectifs sont visibles :
- Dans la VictoryModal (après chaque victoire)
- Sur la page profil
- Sur l'écran d'accueil (widget résumé)

---

---

## 17. Référence implémentation — Todo ordonné

### 🔴 PRIORITÉ 1 — Bugs critiques (avant prochaine release)

```
[ ] badgeEngine.ts : refonte seuils vitesse → ratios (§3.4)
[ ] badgeEngine.ts : corriger amelioration_etoile → ratio < 0.06 && failCount === 0
[ ] badgeEngine.ts : ajouter improvedChallengesCount dans GameContext
[ ] badgeEngine.ts : ajouter la condition amelioration_fusee dans evaluateBadges()
[ ] playerStore.ts : ajouter earnedAt: Record<string, string> dans PlayerState
[ ] playerStore.ts : stocker la date d'obtention dans awardBadges()
[ ] playerService.ts : ajouter earnedAt dans PlayerProfile + migrateProfile()
[ ] badges.ts : corriger emojis dédupliqués (👑×2, 🌳×2, 🎯×2)
[ ] badges.ts : remplacer 💀 par 🌿 pour exploration_crane
[ ] profile.tsx : corriger prix 3,99€ → 2,99€
[ ] [challengeId].tsx : appeler recordFriendInvited() dans le flux invitation
[ ] [challengeId].tsx : afficher noErrorStreak 🔥 dans le header
```

### 🟠 PRIORITÉ 2 — Rang Forêt + UX

```
[ ] playerStore.ts : ajouter rangPoints: number dans PlayerState
[ ] playerStore.ts : calculer rangPoints à chaque victoire + badge + mission
[ ] playerService.ts : ajouter rangPoints dans PlayerProfile
[ ] leaderboardService.ts : remplacer score par rangPoints
[ ] Créer src/constants/ranks.ts : définition des 8 rangs
[ ] Créer composant <ForestRankBadge /> : affiche rang + nom du rang
[ ] Intégrer <ForestRankBadge /> dans : profil, header défi ami, classement
[ ] Créer composant <ActiveGoals /> : 3 badges actifs avec progression
[ ] Intégrer <ActiveGoals /> dans VictoryModal (remplace BadgeProgressInline)
[ ] Intégrer <ActiveGoals /> dans l'écran d'accueil
[ ] Ajouter tooltip first-time sur la section Badges
[ ] Rendre la vitrine badges accessible depuis l'accueil
[ ] VictoryModal : afficher progression rang ("Rang : 🌿 Pousse → +X pts")
```

### 🟡 PRIORITÉ 3 — Défis Journaliers + La Clairière

```
DÉFIS JOURNALIERS :
[ ] Créer src/services/dailyChallengeService.ts
[ ] Créer src/store/dailyChallengeStore.ts
[ ] Créer app/(tabs)/daily.tsx (nouvel onglet)
[ ] Cloud Function : sélection du défi du jour à minuit UTC
[ ] Ajouter badges dej_premier, dej_semaine, dej_podium dans badges.ts
[ ] Connecter recordTopDEJ() au flux de classement journalier

CLAIRIÈRE :
[ ] Modéliser ClairiereState + ClairiereItem (TypeScript)
[ ] Créer src/store/clairiereStore.ts (Zustand)
[ ] Créer src/services/clairiereService.ts (Firestore CRUD)
[ ] Créer app/(tabs)/clairiere.tsx (nouvel onglet)
[ ] Créer <ClairiereScene /> (rendu des items positionnés)
[ ] Créer <ClairiereShop /> (boutique d'items)
[ ] Créer <ClairiereItemCard /> (carte item achetable)
[ ] Implémenter la persistance Firestore de la Clairière
[ ] Ajouter les 8 nouveaux badges Clairière dans badges.ts
[ ] Ajouter les conditions des nouveaux badges dans badgeEngine.ts
[ ] Ajouter les récompenses d'items dans awardBadges() (items offerts via badges)
[ ] Implémenter multiplicateur ×1.5 graines pour isPremium
```

### 🟢 PRIORITÉ 4 — Missions quotidiennes + nouveaux badges

```
[ ] Créer src/constants/dailyMissions.ts (catalogue des missions)
[ ] Créer src/store/dailyMissionStore.ts (Zustand — missions du jour)
[ ] Créer <DailyMissionsWidget /> (widget accueil)
[ ] Intégrer le déclenchement de missions dans [challengeId].tsx
[ ] Ajouter badges mission_10, mission_30, mission_100 dans badges.ts
[ ] Ajouter badges rang_arbre, rang_foret, rang_esprit dans badges.ts
[ ] Ajouter stats.missionsCompleted dans playerStore + Firestore
```

### 🔵 PRIORITÉ 5 — Système d'étoiles

```
[ ] Modifier VictoryModal : afficher 1, 2 ou 3 étoiles selon ratio
    ⭐ = complété / ⭐⭐ = 0 erreur OU ratio<25% / ⭐⭐⭐ = 0 erreur ET ratio<25%
[ ] Modifier playerStore : stocker challengeStars: Record<string, 1|2|3>
[ ] Modifier l'écran Niveaux : afficher les étoiles sur chaque défi
[ ] Ajouter les bonus graines pour 2 et 3 étoiles dans calculateSeedReward()
[ ] Ajouter badge etoile_parfait (3 étoiles sur 10 défis) dans badges.ts
[ ] Note : utiliser ratio = elapsedMs/estimatedDurationMs (déjà calculé dans badgeEngine)
```

---

---

## Annexe A — Données Firestore complètes après implémentation v3

```typescript
// /players/{userId} — champs ajoutés par le système de badges v3
interface PlayerProfileV3 extends PlayerProfile {
  // Badges
  earnedBadges: string[];
  earnedAt: Record<string, string>;        // NOUVEAU : badgeId → "YYYY-MM-DD"
  badgeShowcase: string[];
  unlockedBonuses: string[];
  unlockedThemes: string[];
  
  // Clairière
  clairiere: {
    items: {
      itemId: string;
      positionX: number;
      positionY: number;
      purchasedAt: string;                 // ISO date
    }[];
    lastUpdated: Timestamp;
  };
  
  // Missions quotidiennes
  dailyMissions: {
    date: string;                          // "YYYY-MM-DD"
    missions: {
      id: string;
      completed: boolean;
      completedAt?: string;
    }[];
  };
  
  // Rang Forêt
  rangPoints: number;                          // NOUVEAU : jamais réduit
  
  // Étoiles par défi
  challengeStars: Record<string, 1 | 2 | 3>;   // NOUVEAU
  
  // Stats enrichies
  stats: {
    // ... champs existants ...
    improvedChallengesCount: number;            // DÉJÀ PRÉSENT — à utiliser dans badgeEngine
    missionsCompleted: number;                  // NOUVEAU : total missions accomplies
    totalStarsEarned: number;                   // NOUVEAU : total d'étoiles obtenues
    threeStarChallenges: number;               // NOUVEAU : défis 3 étoiles
  };
}
```

---

## Annexe B — estimatedDuration réelles par niveau (données mesurées)

> Ces valeurs sont les valeurs exactes stockées dans les JSON de défis.
> Le ratio moyen temps_réel/estimatedDuration est de ~11-14%.

| Niveau | estimatedDuration | Temps réel moyen | Pour ⭐⭐⭐ (< 25%) | Pour 💎 tornade (< 6%) |
|--------|------------------|-----------------|-------------------|------------------------|
| 1 | 105 s | ~10 s | < 26 s | < 6 s |
| 2 | 180 s | ~20 s | < 45 s | < 11 s |
| 3 | 210 s | ~30 s | < 52 s | < 13 s |
| 4 | 285 s | ~35 s | < 71 s | < 17 s |
| 5 | 390 s | ~40 s | < 97 s | < 23 s |
| 6 | 210 s | ~30 s | < 52 s | < 13 s |
| 7 | 345 s | ~45 s | < 86 s | < 21 s |
| 8 | 450 s | ~55 s | < 112 s | < 27 s |
| 9 | 345 s | ~45 s | < 86 s | < 21 s |
| 10 | 450 s | ~60 s | < 112 s | < 27 s |
| 11 | 510 s | ~65 s | < 127 s | < 31 s |
| 12 | 600 s | ~75 s | < 150 s | < 36 s |
| 13 | 750 s | ~90 s | < 187 s | < 45 s |

---

## Annexe C — Équilibre badges par niveau de progression

| Niveau joueur | Badges accessibles | Graines cumulées (estimation) |
|--------------|-------------------|-------------------------------|
| Débutant (niveaux 1-3) | 5–8 badges Bois | 40–120 🌱 |
| Intermédiaire (4-7) | +6 badges Pierre | +90–180 🌱 |
| Avancé (8-11) | +5 badges Or | +150–200 🌱 |
| Expert (12-15) | +4 badges Cristal | +300–400 🌱 |
| Maître (all content) | Tous les badges | ~1 400 🌱 total |

---

---

## Annexe D — Questions ouvertes à trancher

| Question | Options | Recommandation |
|----------|---------|----------------|
| Le défi journalier est-il gratuit ou premium ? | Gratuit / Premium / Hybride | **Gratuit** — c'est un mécanisme de rétention clé |
| Le Mode Zen (palier 6 bois) : c'est quoi exactement ? | Timer caché / Pas de timer / Musique zen | À définir avant implémentation |
| Les badges de régularité lune/soleil : les garder ? | Garder / Remplacer / Renommer | **Renommer** avec des conditions plus accessibles (§15.1) |
| Le rang est-il visible par les amis dans le défi ami ? | Oui / Non | **Oui** — social et motivant |
| Faut-il une limite de Clairière (nombre max d'items) ? | Oui / Non | **Non** pour les premium, **15 items max** pour les gratuits |
| Les animations animaux sont-elles des emoji ou des sprites ? | Emoji animés / Sprites Lottie / React Native Animated | **Emoji animés** (léger, multiplateforme) |
| L'`estimatedDuration` doit-elle être recalibrée ? | Oui / Non | **Oui** : diviser par 8 pour refléter la réalité, OU garder en l'état et toujours utiliser des ratios dans le code |

---

*Document rédigé le 2025 — Version 3.0. À mettre à jour après chaque phase d'implémentation.*
