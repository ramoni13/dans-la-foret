// Clearing Viewer Script
// Structure des dossiers supposée :
// project/
// ├── assets/sprites/
// └── scripts/clearing-viewer.js

const SPRITES = [
  // Entities / Animals
  { id: 'stag', name: 'Cerf', src: '../assets/sprites/stag.png' },
  { id: 'boar', name: 'Sanglier', src: '../assets/sprites/boar.png' },
  { id: 'fox', name: 'Renard', src: '../assets/sprites/fox.png' },
  { id: 'wolf', name: 'Loup', src: '../assets/sprites/wolf.png' },
  { id: 'owl', name: 'Chouette', src: '../assets/sprites/owl.png' },
  { id: 'lumberjack', name: 'Bûcheron', src: '../assets/sprites/lumberjack.png' },

  // Vegetation / Trees
  { id: 'tree_pine', name: 'Sapin', src: '../assets/sprites/tree_pine.png' },
  { id: 'tree_oak', name: 'Chêne', src: '../assets/sprites/tree_oak.png' },
  { id: 'tree_birch', name: 'Bouleau', src: '../assets/sprites/tree_birch.png' },
  { id: 'bush', name: 'Buisson', src: '../assets/sprites/bush.png' },
  { id: 'stump', name: 'Souche', src: '../assets/sprites/stump.png' },
  { id: 'mushroom', name: 'Champignon', src: '../assets/sprites/mushroom.png' },

  // Buildings / Objects
  { id: 'cabin', name: 'Chalet', src: '../assets/sprites/cabin.png' },
  { id: 'campfire', name: 'Feu de camp', src: '../assets/sprites/campfire.png' },
  { id: 'logs', name: 'Tas de bois', src: '../assets/sprites/logs.png' },
  { id: 'rock', name: 'Rocher', src: '../assets/sprites/rock.png' },

  // Tiles
  { id: 'tile_grass', name: 'Tuile Herbe', src: '../assets/sprites/tile_grass.png' },
  { id: 'tile_dirt', name: 'Tuile Terre', src: '../assets/sprites/tile_dirt.png' },
  { id: 'tile_water', name: 'Tuile Eau', src: '../assets/sprites/tile_water.png' }
];

// Gestionnaire de chargement et d'affichage des sprites
class ClearingViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.loadedImages = {};
    this.init();
  }

  async init() {
    console.log("Initialisation du Clearing Viewer...");
    await this.preloadSprites();
    this.render();
  }

  // Préchargement des images PNG transparentes
  preloadSprites() {
    const promises = SPRITES.map(sprite => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = sprite.src;
        img.onload = () => {
          this.loadedImages[sprite.id] = img;
          resolve(sprite.id);
        };
        img.onerror = () => {
          console.error(`Erreur de chargement pour l'image : ${sprite.src}`);
          reject(`Impossible de charger ${sprite.src}`);
        };
      });
    });

    return Promise.allSettled(promises);
  }

  // Exemple d'affichage dynamique dans le DOM
  render() {
    if (!this.container) return;

    this.container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'clearing-grid';

    SPRITES.forEach(sprite => {
      const card = document.createElement('div');
      card.className = 'sprite-card';

      const img = this.loadedImages[sprite.id];
      if (img) {
        card.appendChild(img.cloneNode(true));
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'error-placeholder';
        placeholder.textContent = 'Image introuvable';
        card.appendChild(placeholder);
      }

      const label = document.createElement('span');
      label.textContent = sprite.name;
      card.appendChild(label);

      grid.appendChild(card);
    });

    this.container.appendChild(grid);
  }
}

// Export / Auto-initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Remplace 'viewer-container' par l'ID de ton div HTML si nécessaire
  if (document.getElementById('viewer-container')) {
    window.clearingViewer = new ClearingViewer('viewer-container');
  }
});