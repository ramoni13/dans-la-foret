// Diagnostic précis : combien de solutions UNIQUES existent avec les nouvelles règles ?
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
  chalet: { id:'chalet', label:'Chalet', icon:ICON, color:'#A0522D', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'},{type:'neighbor_specific',mode:'require',scope:'neighbor',targetElementId:'bucheron',minCount:1}] },
  renard: { id:'renard', label:'Renard', icon:ICON, color:'#FF6B35', maxPerBoard:4,
    constraints:[{type:'neighbor_same',mode:'forbid',scope:'neighbor'},{type:'neighbor_specific',mode:'forbid',scope:'neighbor',targetElementId:'mouton'}] },
};

const board8: BoardDefinition = {
  id:'board_8_v2', label:'Lisiere', cellCount:8,
  connections:[[1,2,5],[0,3],[0,4],[1,4,5,6],[2,3,5,7],[0,3,4,6,7],[3,5],[4,5]],
  cellPositions:[{x:50,y:12},{x:25,y:30},{x:75,y:30},{x:25,y:52},{x:75,y:52},{x:50,y:62},{x:25,y:80},{x:75,y:80}],
  backgroundAsset:null as any, availableElements:[],
};

const board12: BoardDefinition = {
  id:'board_12', label:'Foret', cellCount:12,
  connections:[[1,3,4,10],[0,2,5,11],[1,3,4,9],[0,2,5,8],[0,2,6,7],[1,3,6,7],[4,5,8,10],[4,5,9,11],[3,6,9,11],[2,7,8,10],[0,6,9,11],[1,7,8,10]],
  cellPositions:[{x:15,y:10},{x:85,y:10},{x:35,y:22},{x:65,y:22},{x:20,y:40},{x:80,y:40},{x:20,y:62},{x:80,y:62},{x:35,y:78},{x:65,y:78},{x:15,y:88},{x:85,y:88}],
  backgroundAsset:null as any, availableElements:[],
};

console.log('=== NIVEAU_3 : compositions sans chien (3 vides = 5 fixes) ===');
const compos3 = [
  {bucheron:3,ours:3,mouton:2},
  {bucheron:3,ours:2,mouton:3},
  {bucheron:2,ours:3,mouton:3},
  {bucheron:4,ours:3,mouton:1},
  {bucheron:4,ours:2,mouton:2},
  {bucheron:2,ours:4,mouton:2},
];
for (const c of compos3) {
  const tokens = Object.entries(c).filter(([,v])=>v>0).map(([id,count])=>({elementId:id,count:count as number}));
  const r = solve({boardDef:board8,fixedPlacements:[],availableTokens:tokens,elementDefs});
  const label = Object.entries(c).map(([k,v])=>k.substring(0,3)+v).join('+');
  console.log(`  ${label}: ${r.solutionCount} solutions`);
}

console.log('\n=== NIVEAU_12 : compositions simplifiées (7 vides = 5 fixes) ===');
const compos12 = [
  {bucheron:2,ours:2,mouton:2,chien:2,chalet:2,renard:2},
  {bucheron:3,ours:2,mouton:2,chien:2,chalet:1,renard:2},
  {bucheron:3,ours:3,mouton:2,chien:2,chalet:0,renard:2},
  {bucheron:4,ours:3,mouton:3,chien:0,chalet:0,renard:2},
  {bucheron:3,ours:4,mouton:3,chien:0,chalet:0,renard:2},
  {bucheron:4,ours:2,mouton:2,chien:2,chalet:0,renard:2},
];
for (const c of compos12) {
  const tokens = Object.entries(c).filter(([,v])=>v>0).map(([id,count])=>({elementId:id,count:count as number}));
  const r = solve({boardDef:board12,fixedPlacements:[],availableTokens:tokens,elementDefs});
  const label = Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>k.substring(0,3)+v).join('+');
  console.log(`  ${label}: ${r.solutionCount} solutions`);
}
