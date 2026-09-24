// Test de la déduplication canonique du solveur
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
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'}] },
  chien: { id:'chien', label:'Chien', icon:ICON, color:'#D2691E', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'require',scope:'neighbor',minCount:1}] },
};

const board6: BoardDefinition = {
  id:'board_6_v1', label:'Clairiere', cellCount:6,
  connections:[[1,3],[0,2,4,5],[1,3,4],[0,2,4,5],[1,2,3],[1,3]],
  cellPositions:[{x:50,y:15},{x:28,y:42},{x:50,y:35},{x:72,y:42},{x:50,y:58},{x:50,y:78}],
  backgroundAsset:null as any,
  availableElements:['bucheron','ours','mouton','chien'],
};

console.log('=== Test déduplication canonique ===\n');
console.log('Plateau 6 cases (board_6_v1)\n');

const compos = [
  {bucheron:2,ours:1,mouton:1,chien:2},
  {bucheron:1,ours:2,mouton:1,chien:2},
  {bucheron:1,ours:1,mouton:2,chien:2},
  {bucheron:2,ours:2,mouton:0,chien:2},
  {bucheron:3,ours:1,mouton:1,chien:1},
  {bucheron:1,ours:3,mouton:1,chien:1},
  {bucheron:1,ours:1,mouton:3,chien:1},
  {bucheron:1,ours:1,mouton:1,chien:3},
  {bucheron:2,ours:2,mouton:2},
];

compos.forEach(c => {
  const total = Object.values(c).reduce((a,b)=>a+b,0);
  if (total !== 6) return;
  const tokens = Object.entries(c).filter(([,v])=>v>0).map(([id,count])=>({elementId:id,count}));
  const r = solve({boardDef:board6,fixedPlacements:[],availableTokens:tokens,elementDefs});
  const label = Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>k.substring(0,3)+v).join('+');
  const status = r.solutionCount === 1 ? '✅ UNIQUE' : r.solutionCount === 0 ? '❌ IMPOSSIBLE' : `⚠️  ${r.solutionCount} solutions`;
  console.log(`${label.padEnd(28)} → ${status}`);
  if (r.solutionCount <= 3) {
    r.solutions.forEach((s,i) => console.log(`  sol${i+1}: [${s.map(e=>e.substring(0,3)).join(',')}]`));
  }
});

console.log('\n=== Maintenant avec fixedPlacements (niveau_2 : 4 vides = 2 fixes) ===\n');

// Test avec chien=2 et 1 chien fixé
const tokens = [{elementId:'bucheron',count:2},{elementId:'ours',count:1},{elementId:'mouton',count:1},{elementId:'chien',count:2}];
const full = solve({boardDef:board6,fixedPlacements:[],availableTokens:tokens,elementDefs});
console.log(`buc2+our1+mou1+chi2 : ${full.solutionCount} solution(s) totale(s)`);
full.solutions.forEach((sol,i) => {
  const chienCells = sol.map((e,idx)=>e==='chien'?idx:-1).filter(i=>i>=0);
  console.log(`  sol${i+1}: [${sol.map(e=>e.substring(0,3)).join(',')}] — chiens en cases ${chienCells.join(',')}`);
  
  // Fixer 1 chien + 1 autre
  const otherCells = sol.map((e,idx)=>e!=='chien'?idx:-1).filter(i=>i>=0);
  for (const cc of chienCells) {
    for (const oc of otherCells) {
      const fixed = [{cellIndex:cc,elementId:'chien'},{cellIndex:oc,elementId:sol[oc]}];
      const avail = tokens.map(t=>t.elementId==='chien'?{...t,count:t.count-1}:t).filter(t=>t.count>0);
      const r = solve({boardDef:board6,fixedPlacements:fixed,availableTokens:avail,elementDefs});
      if (r.solutionCount === 1) {
        console.log(`    ✅ UNIQUE avec chien fixé en ${cc} + ${sol[oc].substring(0,3)} fixé en ${oc}`);
      }
    }
  }
});
