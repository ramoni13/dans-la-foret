// Diagnostic : pourquoi les niveaux 3, 12, 13 bloquent ?
import { solve } from '../src/core/engine/solver';
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { LEVEL_PARAMS } from '../src/constants/difficulty';

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
  chalet: { id:'chalet', label:'Chalet', icon:ICON, color:'#A0522D', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'},{type:'neighbor_specific',mode:'require',scope:'neighbor',targetElementId:'bucheron',minCount:1}] },
  renard: { id:'renard', label:'Renard', icon:ICON, color:'#FF6B35', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'},{type:'neighbor_specific',mode:'forbid',scope:'neighbor',targetElementId:'mouton'}] },
};

const boards: Record<string, BoardDefinition> = {
  board_8_v2: {
    id:'board_8_v2', label:'Lisiere', cellCount:8,
    connections:[[1,2,5],[0,3],[0,4],[1,4,5,6],[2,3,5,7],[0,3,4,6,7],[3,5],[4,5]],
    cellPositions:[{x:50,y:12},{x:25,y:30},{x:75,y:30},{x:25,y:52},{x:75,y:52},{x:50,y:62},{x:25,y:80},{x:75,y:80}],
    backgroundAsset:null as any, availableElements:[],
  },
  board_12: {
    id:'board_12', label:'Foret', cellCount:12,
    connections:[[1,3,4,10],[0,2,5,11],[1,3,4,9],[0,2,5,8],[0,2,6,7],[1,3,6,7],[4,5,8,10],[4,5,9,11],[3,6,9,11],[2,7,8,10],[0,6,9,11],[1,7,8,10]],
    cellPositions:[{x:15,y:10},{x:85,y:10},{x:35,y:22},{x:65,y:22},{x:20,y:40},{x:80,y:40},{x:20,y:62},{x:80,y:62},{x:35,y:78},{x:65,y:78},{x:15,y:88},{x:85,y:88}],
    backgroundAsset:null as any, availableElements:[],
  },
};

function testLevel(levelName: 'niveau_3' | 'niveau_12' | 'niveau_13') {
  const params = LEVEL_PARAMS[levelName];
  const board = boards[params.boardId];
  const [minEmpty] = params.emptyCellsRange;
  const targetFixed = params.cellCount - minEmpty;

  console.log(`\n=== ${levelName.toUpperCase()} (${params.cellCount} cases, ${minEmpty} vides, ${targetFixed} fixes) ===`);

  let totalSolutions = 0;
  let totalWithEnoughFixed = 0;

  for (const comp of params.compositions) {
    const total = Object.values(comp).reduce((a,b)=>a+(b??0),0);
    if (total !== params.cellCount) { console.log(`  SKIP ${JSON.stringify(comp)} total=${total}`); continue; }

    const tokens = Object.entries(comp).filter(([,v])=>(v??0)>0).map(([id,count])=>({elementId:id,count:count!}));
    const r = solve({boardDef:board, fixedPlacements:[], availableTokens:tokens, elementDefs});

    const label = Object.entries(comp).filter(([,v])=>(v??0)>0).map(([k,v])=>k.substring(0,3)+v).join('+');

    if (r.solutionCount === 0) {
      console.log(`  ${label}: 0 solutions (composition impossible sur ce plateau)`);
      continue;
    }

    totalSolutions += r.solutionCount;

    // Simuler la règle "tous fixes interdit" avec targetFixed cases fixes
    // Pour chaque solution, compter combien de configurations de fixes sont valides
    let validConfigs = 0;
    for (const sol of r.solutions) {
      // Vérifier si on peut choisir targetFixed cases telles que
      // pour chaque élément présent en >= 2, au moins 1 est à poser
      const elemCells: Record<string,number[]> = {};
      sol.forEach((el,i) => { if(!elemCells[el]) elemCells[el]=[]; elemCells[el].push(i); });

      // Éléments avec >= 2 exemplaires : au moins 1 doit rester à poser
      // = au moins 1 ne doit PAS être fixé
      // Avec targetFixed fixes sur cellCount cases, il reste minEmpty à poser
      // La règle est satisfaite si pour chaque élément en >=2, count(elem) > targetFixed_de_cet_elem
      // En pratique : si on fixe targetFixed cases aléatoirement, la règle peut bloquer

      // Compter les éléments en >= 2 qui ont EXACTEMENT targetFixed exemplaires
      // (dans ce cas, si on les fixe tous, la règle échoue)
      let canSatisfy = true;
      for (const [el, cells] of Object.entries(elemCells)) {
        if (cells.length >= 2 && cells.length <= targetFixed) {
          // Si tous les exemplaires de cet élément sont fixés, règle violée
          // Mais on peut choisir de ne pas tous les fixer
          // → possible seulement si cells.length < targetFixed (on peut en laisser 1 libre)
          // Si cells.length === targetFixed et on doit fixer exactement targetFixed cases,
          // on POURRAIT fixer tous les exemplaires de cet élément
          // La règle dit : au moins 1 à poser → au moins 1 non fixé
          // Donc : on ne peut pas fixer TOUS les exemplaires d'un élément en >=2
          // C'est toujours possible de ne pas les fixer tous si cells.length < cellCount
        }
      }
      validConfigs++;
    }

    console.log(`  ${label}: ${r.solutionCount} sol(s) totales`);
    totalWithEnoughFixed += validConfigs;
  }

  console.log(`  → Total solutions: ${totalSolutions}, configs valides estimées: ${totalWithEnoughFixed}`);
  console.log(`  → Problème probable: ${totalSolutions === 0 ? 'AUCUNE SOLUTION sur ce plateau' : 'Règle trop restrictive'}`);
}

testLevel('niveau_3');
testLevel('niveau_12');
testLevel('niveau_13');
