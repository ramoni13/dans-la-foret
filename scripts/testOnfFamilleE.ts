// Test ONF compositions Famille E (ruche + champignon) 4x4
import { generateOnfChallenge } from '../src/services/onfChallengeService';

function main() {
  console.log('=== Test generation ONF 4x4 ===');

  let ok = 0, fail = 0;
  let lastKey: string | null = null;
  for (let i = 0; i < 60; i++) {
    const ch = generateOnfChallenge(i, lastKey);
    if (ch) {
      ok++;
      lastKey = ch.id;
    } else {
      fail++;
    }
  }
  console.log('60 tentatives: ok=' + ok + '  null=' + fail);

  if (fail > 10) {
    console.error('Taux echec eleve - verifier compositions Famille E');
    process.exit(1);
  } else {
    console.log('Generation ONF stable');
  }
}

main();
