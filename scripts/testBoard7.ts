// Validation du plateau 7 cases pour niveau_2 : 4 vides = 3 fixes
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

const board7: BoardDefinition = {
  id:'board_7_v1', label:'Clairiere', cellCount:7,
  connections:[
    [1, 2],        // 0
    [0, 3, 4],     // 1
    [0, 3, 5],     // 2
    [1, 2, 4, 5],  // 3 — hub
    [1, 3, 6],     // 4
    [2, 3, 6],     // 5
    [4, 5],        // 6
  ],
  cellPositions:[
    {x:50,y:10},{x:25,y:32},{x:75,y:32},
    {x:50,y:50},{x:25,y:68},{x:75,y:68},{x:50,y:88},
  ],
  backgroundAsset:null as any,
  availableElements:['bucheron','ours','mouton','chien'],
};

// Compositions pour niveau_2 : total = 7, 4 vides = 3 fixes
const compos: Record<string,number>[] = [];
for (let chi = 2; chi <= 4; chi++) {
  for (let buc = 0; buc <= 4; buc++) {
    for (let our = 0; our <= 4; our++) {
      for (let mou = 0; mou <= 4; mou++) {
        if (buc + our + mou + chi === 7 && buc <= 4 && our <= 4 && mou <= 4) {
          compos.push({bucheron:buc, ours:our, mouton:mou, chien:chi});
        }
      }
    }
  }
}

console.log(`Plateau 7 cases — niveau_2 (4 vides = 3 fixes)`);
console.log(`Test de ${compos.length} compositions avec chien >= 2\n`);

let found = 0;
const goodCompos: string[] = [];

compos.forEach(c => {
  const tokens = Object.entries(c).filter(([,v])=>v>0).map(([id,count])=>({elementId:id,count}));
  const full = solve({boardDef:board7, fixedPlacements:[], availableTokens:tokens, elementDefs});
  const label = Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>k.substring(0,3)+v).join('+');
  const chienCount = c['chien'] ?? 0;

  if (full.solutionCount === 0) return;

  // Chercher des fixedPlacements (3 fixes) qui donnent unicité + tension chien
  let bestFixed: string | null = null;

  for (const sol of full.solutions) {
    if (bestFixed) break;
    const chienCells = sol.map((e,i)=>e==='chien'?i:-1).filter(i=>i>=0);
    const otherCells = sol.map((e,i)=>e!=='chien'?i:-1).filter(i=>i>=0);

    // 1 chien fixe + 2 autres fixes
    for (const cc of chienCells) {
      if (bestFixed) break;
      for (let i = 0; i < otherCells.length; i++) {
        if (bestFixed) break;
        for (let j = i+1; j < otherCells.length; j++) {
          const fixed = [
            {cellIndex:cc, elementId:'chien'},
            {cellIndex:otherCells[i], elementId:sol[otherCells[i]]},
            {cellIndex:otherCells[j], elementId:sol[otherCells[j]]},
          ];
          const avail = tokens.map(t=>t.elementId==='chien'?{...t,count:t.count-1}:t).filter(t=>t.count>0);
          const r = solve({boardDef:board7, fixedPlacements:fixed, availableTokens:avail, elementDefs});
          if (r.solutionCount === 1) {
            const chienAvail = avail.find(t=>t.elementId==='chien');
            if (chienAvail && chienAvail.count >= 1) {
              bestFixed = `chien@${cc} + ${sol[otherCells[i]].substring(0,3)}@${otherCells[i]} + ${sol[otherCells[j]].substring(0,3)}@${otherCells[j]}`;
              break;
            }
          }
        }
      }
    }
  }

  if (bestFixed) {
    found++;
    goodCompos.push(label);
    console.log(`✅ ${label.padEnd(28)} (${full.solutionCount} sols totales) → ex: ${bestFixed}`);
  }
});

console.log(`\n${found} compositions utilisables`);
console.log('\nCompositions recommandées pour difficulty.ts :');
goodCompos.slice(0, 15).forEach(c => console.log('  ' + c));
