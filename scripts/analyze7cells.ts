// Analyse du plateau 7 cases pour niveau_2
// Teste plusieurs topologies et compositions
import { solve } from '../src/core/engine/solver';
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';

const ICON: any = 'placeholder';

const elementDefs: Record<string, ElementDefinition> = {
  bucheron: { id:'bucheron', label:'Bucheron', icon:ICON, color:'#8B4513', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'}] },
  ours: { id:'ours', label:'Ours', icon:ICON, color:'#6B4226', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'}] },
  mouton: { id:'mouton', label:'Mouton', icon:ICON, color:'#E8E8E8', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'},{type:'neighbor_specific',mode:'forbid',scope:'neighbor',targetElementId:'renard'}] },
  chien: { id:'chien', label:'Chien', icon:ICON, color:'#D2691E', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'require',scope:'neighbor',minCount:1}] },
};

// ============================================================
// TOPOLOGIE A : Losange étiré (nœud central fort)
//       [0]
//   [1]     [2]
//       [3]        ← hub central
//   [4]     [5]
//       [6]
// ============================================================
const boardA: BoardDefinition = {
  id:'board_7_v1', label:'Sentier', cellCount:7,
  connections:[
    [1, 2],        // 0 — haut
    [0, 3, 4],     // 1 — gauche haut
    [0, 3, 5],     // 2 — droite haut
    [1, 2, 4, 5],  // 3 — centre (hub)
    [1, 3, 6],     // 4 — gauche bas
    [2, 3, 6],     // 5 — droite bas
    [4, 5],        // 6 — bas
  ],
  cellPositions:[
    {x:50,y:10},  // 0
    {x:25,y:32},  // 1
    {x:75,y:32},  // 2
    {x:50,y:50},  // 3 — centre
    {x:25,y:68},  // 4
    {x:75,y:68},  // 5
    {x:50,y:88},  // 6
  ],
  backgroundAsset:null as any,
  availableElements:['bucheron','ours','mouton','chien'],
};

// ============================================================
// TOPOLOGIE B : Étoile asymétrique (2 hubs)
//   [0]   [1]
//       [2]        ← hub haut
//   [3]   [4]
//       [5]        ← hub bas
//       [6]
// ============================================================
const boardB: BoardDefinition = {
  id:'board_7_v2', label:'Sentier', cellCount:7,
  connections:[
    [2, 3],        // 0 — coin haut gauche
    [2, 4],        // 1 — coin haut droite
    [0, 1, 3, 4, 5], // 2 — hub haut
    [0, 2, 5],     // 3 — gauche milieu
    [1, 2, 5],     // 4 — droite milieu
    [2, 3, 4, 6],  // 5 — hub bas
    [5],           // 6 — bas
  ],
  cellPositions:[
    {x:22,y:12},  // 0
    {x:78,y:12},  // 1
    {x:50,y:30},  // 2 — hub haut
    {x:22,y:52},  // 3
    {x:78,y:52},  // 4
    {x:50,y:68},  // 5 — hub bas
    {x:50,y:88},  // 6
  ],
  backgroundAsset:null as any,
  availableElements:['bucheron','ours','mouton','chien'],
};

// ============================================================
// TOPOLOGIE C : Chaîne avec branchements (style organique)
//   [0]
//   [1]   [2]
//   [3]
//   [4]   [5]
//   [6]
// ============================================================
const boardC: BoardDefinition = {
  id:'board_7_v3', label:'Sentier', cellCount:7,
  connections:[
    [1],           // 0 — haut
    [0, 2, 3],     // 1 — milieu haut gauche
    [1, 3],        // 2 — milieu haut droite
    [1, 2, 4, 5],  // 3 — centre
    [3, 6],        // 4 — milieu bas gauche
    [3, 6],        // 5 — milieu bas droite
    [4, 5],        // 6 — bas
  ],
  cellPositions:[
    {x:25,y:8},   // 0
    {x:25,y:28},  // 1
    {x:72,y:28},  // 2
    {x:50,y:50},  // 3 — centre
    {x:25,y:72},  // 4
    {x:72,y:72},  // 5
    {x:50,y:90},  // 6
  ],
  backgroundAsset:null as any,
  availableElements:['bucheron','ours','mouton','chien'],
};

// Compositions à tester pour niveau_2 (total = 7, 4 vides = 3 fixes)
const compos = [
  // Avec chien=2
  {bucheron:2,ours:2,mouton:1,chien:2},
  {bucheron:2,ours:1,mouton:2,chien:2},
  {bucheron:1,ours:2,mouton:2,chien:2},
  {bucheron:3,ours:1,mouton:1,chien:2},
  {bucheron:1,ours:3,mouton:1,chien:2},
  {bucheron:1,ours:1,mouton:3,chien:2},
  {bucheron:3,ours:2,mouton:0,chien:2},
  {bucheron:2,ours:3,mouton:0,chien:2},
  {bucheron:3,ours:0,mouton:2,chien:2},
  {bucheron:0,ours:3,mouton:2,chien:2},
  // Avec chien=4
  {bucheron:2,ours:1,mouton:0,chien:4},
  {bucheron:1,ours:2,mouton:0,chien:4},
  {bucheron:2,ours:0,mouton:1,chien:4},
  {bucheron:0,ours:2,mouton:1,chien:4},
  {bucheron:1,ours:0,mouton:2,chien:4},
  {bucheron:0,ours:1,mouton:2,chien:4},
  {bucheron:3,ours:0,mouton:0,chien:4},
  {bucheron:0,ours:3,mouton:0,chien:4},
  {bucheron:0,ours:0,mouton:3,chien:4},
];

function testBoard(board: BoardDefinition, name: string) {
  console.log(`\n=== ${name} ===`);
  console.log('Connexions moyennes: ' + (board.connections.reduce((s,c)=>s+c.length,0)/board.cellCount).toFixed(1));
  
  let totalUnique = 0;
  let totalWithTension = 0;

  compos.forEach(c => {
    const total = Object.values(c).reduce((a,b)=>a+b,0);
    if (total !== board.cellCount) return;
    
    const tokens = Object.entries(c).filter(([,v])=>v>0).map(([id,count])=>({elementId:id,count}));
    const full = solve({boardDef:board,fixedPlacements:[],availableTokens:tokens,elementDefs});
    const label = Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>k.substring(0,3)+v).join('+');
    const chienCount = (c as any)['chien'] ?? 0;
    
    // Compter les défis uniques possibles avec tension chien
    // Niveau_2 : 4 vides = 3 fixes
    const targetFixed = 3;
    let uniqueWithTension = 0;
    
    if (chienCount >= 2 && full.solutionCount > 0) {
      full.solutions.forEach(sol => {
        const chienCells = sol.map((e,i)=>e==='chien'?i:-1).filter(i=>i>=0);
        // Essayer de fixer 1 chien (tension : 1 fixe + 1 à poser minimum)
        for (let fi = 0; fi < chienCells.length; fi++) {
          // Fixer targetFixed cases dont au moins 1 chien
          const nonChienCells = sol.map((e,i)=>e!=='chien'?i:-1).filter(i=>i>=0);
          // 1 chien fixe + (targetFixed-1) autres
          const fixedSet = [chienCells[fi], ...nonChienCells.slice(0, targetFixed-1)];
          const fixed = fixedSet.map(idx=>({cellIndex:idx,elementId:sol[idx]}));
          const avail = tokens.map(t=>t.elementId==='chien'?{...t,count:t.count-fixed.filter(f=>f.elementId==='chien').length}:t).filter(t=>t.count>0);
          const r = solve({boardDef:board,fixedPlacements:fixed,availableTokens:avail,elementDefs});
          if (r.solutionCount === 1) {
            uniqueWithTension++;
            break; // 1 suffit pour valider la composition
          }
        }
      });
    }
    
    if (uniqueWithTension > 0) {
      totalWithTension++;
      console.log('  ✅ ' + label + ': ' + full.solutionCount + ' sols totales, tension+unicite POSSIBLE');
    } else if (full.solutionCount > 0) {
      console.log('  ⚠️  ' + label + ': ' + full.solutionCount + ' sols totales, pas de tension+unicite');
    }
    if (full.solutionCount === 1) totalUnique++;
  });
  
  console.log(`  → ${totalWithTension} compositions avec tension+unicite possibles`);
}

testBoard(boardA, 'Topologie A — Losange étiré (hub central)');
testBoard(boardB, 'Topologie B — Étoile asymétrique (2 hubs)');
testBoard(boardC, 'Topologie C — Chaîne avec branchements');
