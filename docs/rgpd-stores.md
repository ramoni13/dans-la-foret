# RGPD et publication sur les stores

État au 8 novembre 2026. Éditeur : **KROMIA SAS** (SIRET 107 542 201 00010), contact `contact@studio-kromia.com`.
Source unique dans le code : `src/constants/legal.ts`.

## 1. Pages légales (dossier `Site/`, à déployer chez OVH)

| Page | Fichier | URL publique |
|---|---|---|
| Politique de confidentialité | `Site/confidentialite.html` | https://www.studio-kromia.com/danslaforet/confidentialite.html |
| CGU | `Site/cgu.html` | https://www.studio-kromia.com/danslaforet/cgu.html |
| Mentions légales | `Site/mentions-legales.html` | https://www.studio-kromia.com/danslaforet/mentions-legales.html |
| Suppression de compte | `Site/suppression-compte.html` | https://www.studio-kromia.com/danslaforet/suppression-compte.html |

Feuille de style commune : `Site/legal.css`. **Envoyer les 5 fichiers** dans le dossier `danslaforet/` du site.

### À compléter avant publication (marqués dans les fichiers)

- `mentions-legales.html` : capital social, nom du Président (directeur de la publication), ville du greffe RCS (à vérifier sur le Kbis), n° de TVA intracommunautaire si assujetti.
- `cgu.html` §14 : **médiateur de la consommation** (obligatoire en B2C : adhérer à un médiateur agréé, par ex. CM2C, Medicys, environ 50 à 150 € par an).
- `cgu.html` §7 : vérifier que « 1 € reversé à Planète Urgence » correspond à la convention signée.
- Faire relire les textes par un juriste si possible (ce sont des trames sérieuses, pas un avis juridique).

## 2. Dans l'application

- Inscription : phrase « En créant un compte, tu acceptes les CGU et la politique de confidentialité » avec liens (`LegalConsentNotice`).
- Profil → Réglages : bloc « Informations légales » (`LegalLinksPanel`) puis « Supprimer mon compte » (`DeleteAccountModal`).
- Google Analytics retiré (`measurementId` supprimé de `firebase.ts`).

## 3. Suppression de compte : configuration Firebase requise

`deleteMyAccount` (`src/services/accountDeletionService.ts`) supprime côté client, dans cet ordre :
`dailyChallenges/*/results` (userId), `jackpotClaims` (uid), `friendChallenges` (challengerUid / opponentUid),
`worldRecords` (userId), `leaderboard/{uid}`, `metrics/{uid}`, `players/{uid}`, puis le compte Auth.

`players`, `leaderboard` et `metrics` sont **obligatoires** (échec = le compte Auth n'est pas supprimé, le joueur peut réessayer).
Les autres sont « au mieux » : en cas d'échec, le joueur est invité à écrire au contact.

À vérifier dans la console Firebase :

1. **Index de groupe de collections** : Firestore → Index → Exemptions de champ unique : `results` / champ `userId`,
   activer « Portée : groupe de collections » (ordre croissant). Sinon la requête `collectionGroup('results')` échoue.
2. **Règles Firestore** : le joueur doit pouvoir **supprimer** ses propres documents. Exemple minimal :

```
match /players/{uid}            { allow delete: if request.auth.uid == uid; }
match /leaderboard/{uid}        { allow delete: if request.auth.uid == uid; }
match /metrics/{uid}            { allow delete: if request.auth.uid == uid; }
match /jackpotClaims/{id}       { allow read, delete: if request.auth.uid == resource.data.uid; }
match /worldRecords/{id}        { allow delete: if request.auth.uid == resource.data.userId; }
match /friendChallenges/{id}    { allow delete: if request.auth.uid in [resource.data.challengerUid, resource.data.opponentUid]; }
match /{path=**}/results/{uid}  { allow read: if request.auth != null; allow delete: if request.auth.uid == uid; }
```

(À fusionner avec les règles existantes, qui ne sont pas dans le dépôt.)

3. Demande de suppression par e-mail (sans l'app) : console Firebase → Authentication → supprimer l'utilisateur,
   puis Firestore → supprimer les mêmes documents. Délai annoncé : 30 jours.

## 4. Durées de conservation annoncées

- Compte et données : tant que le compte existe. **Compte gratuit sans connexion depuis 2 ans : supprimé.**
  **Compte Premium : jamais supprimé pour inactivité** (il contient un achat à durée illimitée ; le supprimer d'office
  exposerait à une clause abusive / inexécution du contrat).
  - **Implémentation** : `src/constants/inactiveAccounts.ts` (pur, testé) + `src/services/inactiveAccountService.ts`.
    Au démarrage, **une fois par jour**, si le compte connecté est **administrateur** (`isAdminAccount`) et que le
    drapeau `INACTIVE_PURGE_ON_LAUNCH` (`src/constants/featureFlags.ts`) est à `true` : candidats = `metrics.lastSeenAt`
    et `players.updatedAt` antérieurs à « maintenant − 2 ans » ; décision sur la date la plus récente
    (`lastSeenAt`, `updatedAt`, `createdAt`) ; premium (profil ou métriques), comptes de dev et compte connecté
    conservés ; sans date lisible : conservé. Effacement avec le plan de `buildDeletionPlan` (50 comptes max par jour).
  - **Limite** : le SDK client ne peut pas supprimer le compte **Firebase Auth** d'un autre utilisateur. L'e-mail reste
    dans Authentication : supprimer les uid listés dans le journal (`[inactivePurge]`) depuis la console, ou passer à une
    Cloud Function planifiée (SDK Admin, `auth().deleteUser`) puis mettre `INACTIVE_PURGE_ON_LAUNCH` à `false`.
    Si un joueur purgé se reconnecte, un profil neuf est recréé (`(tabs)/_layout.tsx`).
  - **Règles Firestore requises** : l'administrateur doit pouvoir **lire** `metrics` et `players` (requêtes `<` sur
    `lastSeenAt` / `updatedAt`, index simples automatiques) et **supprimer** les cibles du plan pour un autre uid, par ex.
    `allow read, delete: if request.auth.token.admin == true` (claim personnalisé) ou un uid administrateur en dur.
- Défi entre amis sans réponse : 7 jours (déjà en place).
- E-mails avec le support : 3 ans.

## 5. Google Play Console : « Sécurité des données » (Data safety)

- **L'application collecte-t-elle des données ?** Oui. **Partagées avec des tiers ?** Non (Firebase est un sous-traitant, ce n'est pas un « partage »).
- **Données chiffrées en transit ?** Oui. **Les utilisateurs peuvent-ils demander la suppression ?** Oui → URL : page `suppression-compte.html`.
- **Types de données collectées** (toutes : *collectées, non partagées, obligatoires*) :

| Catégorie Google | Donnée | Finalités à cocher |
|---|---|---|
| Informations personnelles → Adresse e-mail | e-mail | Fonctionnalité de l'appli, Gestion du compte |
| Informations personnelles → Identifiants utilisateur | uid, pseudo | Fonctionnalité de l'appli, Gestion du compte |
| Activité dans l'appli → Interactions avec l'appli | progression, scores, statistiques | Fonctionnalité de l'appli, Données analytiques |
| Activité dans l'appli → Autre contenu généré par l'utilisateur | pseudo public dans les classements | Fonctionnalité de l'appli |
| Informations et performances de l'appli | aucune (pas de Crashlytics) | – |
| Identifiants de l'appareil ou autres | **aucun** (pas d'identifiant publicitaire) | – |

- **Public cible** : 13 ans et plus (tranches 13-15, 16-17, 18+). Ne pas cocher les tranches de moins de 13 ans.
- **Annonces** : « Non, l'application ne contient pas d'annonces » (tant que le Lot E n'est pas branché).
- **URL de suppression de compte** (section dédiée) : page `suppression-compte.html`.
- Questionnaire de classification IARC : aucune violence, aucun contenu sensible → PEGI 3 attendu ; cocher « les utilisateurs peuvent interagir » (classements, défis entre amis, pseudos visibles).

## 6. App Store Connect : « Confidentialité de l'app » (App Privacy)

- **URL de la politique de confidentialité** : page `confidentialite.html`.
- **Données collectées** (pour chacune : *liée à l'identité de l'utilisateur : Oui*, *utilisée pour le suivi : Non*) :
  - Coordonnées → **Adresse e-mail** : Fonctionnalités de l'app.
  - Identifiants → **Identifiant utilisateur** : Fonctionnalités de l'app.
  - Utilisation → **Interactions avec le produit** : Fonctionnalités de l'app, Analyses.
  - Autres données → **Contenu de jeu** (scores, progression) : Fonctionnalités de l'app.
- **Suivi (ATT)** : Non. Pas de demande ATT nécessaire tant qu'il n'y a pas de pub.
- **Âge** : 4+ pour le contenu ; mentionner dans la description que le compte est destiné aux 13 ans et plus.
- **Suppression de compte** (directive 5.1.1(v)) : présente dans Profil → Réglages. Indiquer dans les notes de révision
  le chemin et fournir un **compte de démonstration** à l'équipe Apple.
- **Attention** : si la connexion Google est un jour proposée sur iOS, « Se connecter avec Apple » devient obligatoire (directive 4.8).

## 7. Points ouverts (hors de ce lot)

- Achat Premium simulé (`PremiumCard`) : à brancher sur un vrai paiement (Lot E) ou à masquer, sinon refus probable des stores.
- Lot E (vidéos récompensées, **AppLovin MAX** prévu) : la politique de confidentialité (§ 2, 3, 4, 8, résumé anglais)
  et les CGU (§ 8) décrivent DÉJÀ des vidéos facultatives **non personnalisées** fournies par AppLovin. À garantir
  dans le code : MAX en mode non personnalisé (`setHasUserConsent(false)`, `setDoNotSell(true)`), pas de lecture de
  l'IDFA (donc pas d'ATT), SDK initialisé **seulement au premier lancement d'une vidéo** (« si tu ne lances aucune
  vidéo, rien n'est transmis »). Si AdMob est un réseau de médiation : écran de consentement certifié (CMP) exigé
  par Google en EEE. **Ne pas publier** ces textes avant que le SDK soit intégré, ou les publier avec la version qui
  l'intègre. Questionnaires à mettre à jour à ce moment : Google Play (« Annonces : Oui », données partagées avec un
  tiers à des fins publicitaires : identifiants d'appareil / IP, interactions) et App Store (Données d'utilisation et
  Diagnostics pour « Publicité tierce », non liées à l'identité, **pas** de suivi).
- Règles Firestore absentes du dépôt : à versionner.
