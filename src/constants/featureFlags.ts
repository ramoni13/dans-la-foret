// ============================================================
// DRAPEAUX DE FONCTIONNALITÉS — Dans la Forêt
//
// PROGRESSION_V2 : livraison du chantier « Progression v2 »
// (voir docs/progression-v2.md).
//
// Ce que le drapeau protège (comportements visibles ou destructifs) :
//   - `currentLevel` dérivé des étoiles (computeLevelProgress) au lieu de
//     computePlayerLevel (nombre de défis / 10) ;
//   - graines d'un défi REJOUÉ : 5 🌱 par nouvelle étoile, sinon 0 (C2) ;
//   - remise à zéro unique du profil (progressionVersion < 2, C9), locale + Firestore ;
//   - interface des étoiles, des chapitres, des cérémonies, de l'Herbier et déblocage des modes par chapitre.
//
// Ce que le drapeau ne protège PAS (additif, sans effet visible) :
//   - calcul et enregistrement des étoiles (`challengeStars`, `levelsCompleted`) ;
//   - champs du modèle de données (D) et leur persistance ;
//   - les trophées et les musiques (ils remplacent les badges quel que soit le drapeau).
//
// Valeur actuelle : true (livraison décidée après le Lot 8). Repasser à false désactive l'interface
// et la remise à zéro des profils ; les données déjà écrites (étoiles, cartes, trophées) restent en place.
// ============================================================

export const PROGRESSION_V2 = true;

// ============================================================
// INACTIVE_PURGE_ON_LAUNCH : suppression des comptes GRATUITS sans connexion depuis 2 ans
// (engagement de Site/confidentialite.html § 5 et Site/cgu.html § 3 ; les comptes Premium ne sont jamais purgés).
//
// true  : au démarrage de l'app, une fois par jour au plus, le compte ADMINISTRATEUR connecté
//         (`isAdminAccount`) lance la vérification et la purge (src/services/inactiveAccountService.ts).
//         Un joueur ordinaire ne lance jamais la purge.
// false : plus aucune vérification au démarrage. À passer à false dès qu'une tâche serveur planifiée
//         (Cloud Function, SDK Admin) prend le relais : elle peut AUSSI supprimer le compte Firebase Auth,
//         ce que le SDK client ne sait pas faire pour un autre utilisateur.
// ============================================================
export const INACTIVE_PURGE_ON_LAUNCH = true;
