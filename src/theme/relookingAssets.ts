// src/theme/relookingAssets.ts
// Mapping complet des 15 assets détourés dans assets/relooking/

export const RelookingAssets = {
  // Menu Principal — Compteurs
  compteurPP: require('../../assets/relooking/compteur_pp.png'),
  compteurGraines: require('../../assets/relooking/compteur_graines.png'),

  // Menu Principal — Cartes & Icônes
  pagePapier: require('../../assets/relooking/page_papier.png'),
  flecheGo: require('../../assets/relooking/fleche_go.png'),
  doublePagePapier: require('../../assets/relooking/double_page_papier.png'),
  carteHerbier: require('../../assets/relooking/carte_herbier.png'),
  arbre: require('../../assets/relooking/arbre.png'),

  // Boutons 3D & Encarts
  boutonVert: require('../../assets/relooking/bouton_vert.png'),
  boutonOrange: require('../../assets/relooking/bouton_orange.png'),
  pavePapier: require('../../assets/relooking/pave_papier.png'),

  // Écran Défi — Bandeaux, Plateau & Actions
  pageAvecBandeauBoisBas: require('../../assets/relooking/page_avec_bandeau_bois_bas.png'),
  caseBloquee: require('../../assets/relooking/case_bloquee.png'),
  caseLibre: require('../../assets/relooking/case_libre.png'),
  indice: require('../../assets/relooking/indice.png'),
  verification: require('../../assets/relooking/verification.png'),
  retour: require('../../assets/relooking/retour.png'),
} as const;