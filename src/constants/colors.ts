export const Colors = {
  // Thème forêt
  forest: {
    dark: '#1A3A1A',
    medium: '#2D5A27',
    light: '#4A7C59',
    accent: '#8BC34A',
    bark: '#5C3D1E',
  },

  // États des cases pendant le drag & drop
  cell: {
    empty: '#F5F0E8', // Case vide
    valid: '#4CAF50', // Vert — placement valide (solution[i] === elementId)
    invalid: '#F44336', // Rouge — placement invalide
    hint: '#FF9800', // Orange — case indice bonus
    fixed: '#B0BEC5', // Gris bleuté — jeton fixe non déplaçable
    selected: '#2196F3', // Bleu — case sélectionnée
    correct: '#66BB6A', // Vert clair — case correcte (bonus vérification)
    wrong: '#EF5350', // Rouge clair — case incorrecte (bonus vérification)
  },

  // Couleurs des éléments
  elements: {
    bucheron: '#8B4513',
    ours: '#6B4226',
    mouton: '#90A4AE', // Gris-ardoise — distinct du gris UI 'désactivé'
    chien: '#D2691E',
    chalet: '#A0522D',
    renard: '#FF6B35',
  },

  // UI générale
  ui: {
    background: '#F9F5EE',
    card: '#FFFFFF',
    text: '#2C1810',
    textLight: '#6D4C41',
    border: '#D7CCC8',
    shadow: 'rgba(0,0,0,0.15)',
    seed: '#FFC107', // Couleur des graines (monnaie)
  },
};
