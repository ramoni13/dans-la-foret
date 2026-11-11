import { TREE_IMAGES, TREE_REGION_IDS, TREES_DATA } from '../src/data/treesData';
import { ALL_TREE_CARDS, TOTAL_TREE_CARDS } from '../src/utils/onfCards';

describe('tree card catalog', () => {
  it('uses the 143 illustrated cards once in the herbarium', () => {
    const ids = TREES_DATA.map(tree => tree.id);

    expect(TOTAL_TREE_CARDS).toBe(143);
    expect(ALL_TREE_CARDS).toHaveLength(143);
    expect(ids).toEqual(Array.from({ length: 143 }, (_, index) => index + 1));
    expect(Object.keys(TREE_IMAGES).map(Number).sort((a, b) => a - b)).toEqual(ids);
  });

  it('assigns every card to exactly one region', () => {
    const allRegionIds = Object.values(TREE_REGION_IDS).flat();

    expect(allRegionIds).toHaveLength(143);
    expect(new Set(allRegionIds).size).toBe(143);
    expect([...allRegionIds].sort((a, b) => a - b)).toEqual(TREES_DATA.map(tree => tree.id));
    expect(
      Object.fromEntries(
        Object.entries(TREE_REGION_IDS).map(([region, ids]) => [region, ids.length]),
      ),
    ).toEqual({ france: 62, europe: 11, monde: 59, remarquables: 11 });
    for (const [region, ids] of Object.entries(TREE_REGION_IDS)) {
      expect(TREES_DATA.filter(tree => tree.region === region).map(tree => tree.id)).toEqual(ids);
    }
  });

  it('has photo and license credits on every card', () => {
    expect(TREES_DATA.every(tree => Boolean(tree.photographer && tree.license))).toBe(true);
  });
});
