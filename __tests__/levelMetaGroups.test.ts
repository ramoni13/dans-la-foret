import { LEVEL_META, groupRulesByElement } from '../src/data/levelMeta';

describe('groupRulesByElement (briefing de niveau)', () => {
  it('niveau 1 : une page par élément', () => {
    const groups = groupRulesByElement(LEVEL_META[1].newRules);
    expect(groups.map(g => g.map(r => r.id))).toEqual([
      ['no_same_bucheron'],
      ['no_same_ours'],
      ['no_same_mouton'],
    ]);
  });

  it('niveau 5 : les 2 règles du loup sont sur la même page', () => {
    const groups = groupRulesByElement(LEVEL_META[5].newRules);
    expect(groups).toHaveLength(1);
    expect(groups[0].map(r => r.id)).toEqual(['no_same_loup', 'forbid_loup_mouton']);
  });

  it('niveau 9 : cerf et biche ont chacun leur page, aucune règle perdue', () => {
    const rules = LEVEL_META[9].newRules;
    const groups = groupRulesByElement(rules);
    expect(groups).toHaveLength(2);
    expect(groups.flat()).toHaveLength(rules.length);
  });

  it('chaque règle nouvelle est rattachée à un élément', () => {
    for (const meta of Object.values(LEVEL_META)) {
      for (const rule of meta.newRules) expect(rule.focusElement).toBeTruthy();
    }
  });
});
