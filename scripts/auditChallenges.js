// ============================================================
// AUDIT DES DEFIS — verificateur independant du solveur
// Force brute : teste TOUTES les permutations des jetons a poser
// dans les cases vides et compte les solutions valides.
// Usage : node scripts/auditChallenges.js [niveau_6 niveau_7 ...]
// ============================================================

const path = require('path');

const BOARDS = {
  board_9_v1: [
    [1, 2, 5], [0, 3], [0, 4], [1, 5, 6], [2, 5, 7],
    [0, 3, 4, 6, 7], [3, 5, 8], [4, 5, 8], [6, 7],
  ],
};

const FORBID_SAME = new Set(['bucheron', 'ours', 'mouton', 'cerf', 'biche', 'renard', 'chalet']);
const PARTNER = { cerf: 'biche', biche: 'cerf' };

function isValid(board, C) {
  const n = board.length;
  for (let i = 0; i < n; i++) {
    const el = board[i];
    const nb = C[i].map(j => board[j]);
    if (FORBID_SAME.has(el) && nb.includes(el)) return false;
    if ((el === 'mouton' && nb.includes('renard')) || (el === 'renard' && nb.includes('mouton'))) return false;
    if (el === 'ruche' && !nb.includes('ours')) return false;
    if (el === 'chalet' && !nb.includes('bucheron')) return false;
    if (el === 'chien' && !nb.includes('chien')) return false;
    if (el === 'tas_buches') {
      if (!nb.includes('bucheron')) return false;
      if (board.includes('chalet') && !nb.includes('chalet')) return false;
    }
    if (PARTNER[el] && nb.filter(x => x === PARTNER[el]).length !== 1) return false;
  }
  if (board.filter(x => x === 'cerf').length !== board.filter(x => x === 'biche').length) return false;
  // chiens : un seul groupe connexe
  const dogs = board.map((x, i) => (x === 'chien' ? i : -1)).filter(i => i >= 0);
  if (dogs.length > 1) {
    const seen = new Set([dogs[0]]);
    const q = [dogs[0]];
    while (q.length) {
      const v = q.shift();
      for (const w of C[v]) if (board[w] === 'chien' && !seen.has(w)) { seen.add(w); q.push(w); }
    }
    if (seen.size !== dogs.length) return false;
  }
  return true;
}

function countSolutions(challenge, C) {
  const n = C.length;
  const board = Array(n).fill(null);
  for (const fp of challenge.fixedPlacements) board[fp.cellIndex] = fp.elementId;
  const empties = board.map((x, i) => (x === null ? i : -1)).filter(i => i >= 0);
  const inv = {};
  for (const t of challenge.availableTokens) inv[t.elementId] = t.count;
  const found = new Set();
  const sols = [];
  (function rec(k) {
    if (k === empties.length) {
      if (isValid(board, C)) {
        const key = board.join(',');
        if (!found.has(key)) { found.add(key); sols.push([...board]); }
      }
      return;
    }
    for (const el of Object.keys(inv)) {
      if (inv[el] <= 0) continue;
      inv[el]--; board[empties[k]] = el;
      rec(k + 1);
      inv[el]++; board[empties[k]] = null;
    }
  })(0);
  return sols;
}

const levels = process.argv.slice(2).filter(a => a.startsWith('niveau_'));
const targets = levels.length ? levels : ['niveau_6', 'niveau_7', 'niveau_8'];
let problems = 0;
for (const level of targets) {
  const file = path.resolve(__dirname, `../src/data/challenges/${level}.json`);
  const { challenges } = require(file);
  const compos = new Set();
  for (const c of challenges) {
    const C = BOARDS[c.boardId];
    if (!C) { console.log(`${c.id} : plateau ${c.boardId} non gere par l'audit`); continue; }
    const counts = {};
    c.solution.forEach(e => (counts[e] = (counts[e] ?? 0) + 1));
    compos.add(Object.keys(counts).sort().map(k => k + counts[k]).join(' '));
    const sols = countSolutions(c, C);
    const storedOk = isValid(c.solution, C);
    const status = sols.length === 1 && storedOk ? 'OK' : 'PROBLEME';
    if (status !== 'OK') problems++;
    console.log(`${c.id} : ${sols.length} solution(s), solution stockee ${storedOk ? 'valide' : 'INVALIDE'} -> ${status}`);
    if (sols.length > 1) sols.forEach(s => console.log('     ' + s.join(',')));
  }
  console.log(`  ${level} : ${compos.size} composition(s) distincte(s)\n`);
}
console.log(`Defis problematiques : ${problems}`);
