// ============================================================
// GÉNÉRATEUR DE VIEWER_DATA.js
// Lit tous les fichiers JSON de défis et produit un fichier JS
// chargeable via <script src="VIEWER_DATA.js"> dans VIEWER_DEFIS.html.
//
// Usage : npm run generate:viewer
// Sortie : VIEWER_DATA.js (à la racine de dans-la-foret-app/)
//
// Ce fichier est le SEUL à régénérer quand les défis changent.
// VIEWER_DEFIS.html ne change jamais.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

const LEVELS = [
  'niveau_1', 'niveau_2', 'niveau_3', 'niveau_4', 'niveau_5',
  'niveau_6', 'niveau_7', 'niveau_8', 'niveau_9', 'niveau_10',
  'niveau_11', 'niveau_12', 'niveau_13', 'niveau_14', 'niveau_15',
];

const CHALLENGES_DIR = path.resolve(__dirname, '../src/data/challenges');
const OUTPUT_FILE    = path.resolve(__dirname, '../VIEWER_DATA.js');

function generate() {
  console.log('Génération de VIEWER_DATA.js...');

  const parts: string[] = [];
  let totalChallenges = 0;

  for (const level of LEVELS) {
    const filePath = path.join(CHALLENGES_DIR, `${level}.json`);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  ${level}.json introuvable — niveau ignoré`);
      parts.push(`  '${level}': { "challenges": [] }`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf-8').trim();

    // Validation rapide : s'assurer que c'est du JSON valide
    try {
      const parsed = JSON.parse(raw);
      const count = parsed.challenges?.length ?? 0;
      totalChallenges += count;
      console.log(`  ✓ ${level} — ${count} défis`);
    } catch {
      console.error(`  ✗ ${level}.json invalide — niveau ignoré`);
      parts.push(`  '${level}': { "challenges": [] }`);
      continue;
    }

    parts.push(`  '${level}': ${raw}`);
  }

  const output = [
    '// ============================================================',
    '// VIEWER_DATA.js — Généré automatiquement par generateViewerData.ts',
    `// Date : ${new Date().toISOString()}`,
    `// Total : ${totalChallenges} défis sur ${LEVELS.length} niveaux`,
    '// NE PAS MODIFIER MANUELLEMENT — relancer : npm run generate:viewer',
    '// ============================================================',
    '',
    '/* global ALL_DATA */',
    'const ALL_DATA = {',
    parts.join(',\n'),
    '};',
    '',
  ].join('\n');

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`\n✅ VIEWER_DATA.js généré — ${totalChallenges} défis, ${(output.length / 1024).toFixed(0)} Ko`);
  console.log(`   → ${OUTPUT_FILE}`);
}

generate();
