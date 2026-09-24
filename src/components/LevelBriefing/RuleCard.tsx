// ============================================================
// RuleCard — Une carte de règle avec animation + éléments
// Utilisée dans la FlatList de LevelBriefingModal
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RuleCard as RuleCardData } from '../../data/levelMeta';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { ElementChips } from './ElementChips';

import { NoSameNeighborAnim } from './RuleAnimations/NoSameNeighborAnim';
import { RequireNeighborAnim } from './RuleAnimations/RequireNeighborAnim';
import { ForbidNeighborAnim } from './RuleAnimations/ForbidNeighborAnim';
import { ConnectedGroupAnim } from './RuleAnimations/ConnectedGroupAnim';
import { PairedAnim } from './RuleAnimations/PairedAnim';
import { ChainAnim } from './RuleAnimations/ChainAnim';
import { SingletonAnim } from './RuleAnimations/SingletonAnim';

interface RuleCardProps {
  rule: RuleCardData;
  isNew: boolean;
  width: number;
}

function RuleAnimation({ rule, a11yLabel }: { rule: RuleCardData; a11yLabel: string }) {
  switch (rule.type) {
    case 'no_same_neighbor':
      return <NoSameNeighborAnim rule={rule} accessibilityLabel={a11yLabel} />;
    case 'require_neighbor':
      return <RequireNeighborAnim rule={rule} accessibilityLabel={a11yLabel} />;
    case 'forbid_neighbor':
      return <ForbidNeighborAnim rule={rule} accessibilityLabel={a11yLabel} />;
    case 'connected_group':
      return <ConnectedGroupAnim rule={rule} accessibilityLabel={a11yLabel} />;
    case 'paired':
      return <PairedAnim rule={rule} accessibilityLabel={a11yLabel} />;
    case 'chain':
      return <ChainAnim rule={rule} accessibilityLabel={a11yLabel} />;
    case 'singleton':
      return <SingletonAnim rule={rule} accessibilityLabel={a11yLabel} />;
    default:
      return null;
  }
}

export const RuleCard: React.FC<RuleCardProps> = ({ rule, isNew, width }) => {
  const t = useT();

  const a11yLabel = t(rule.i18nKey, rule.i18nVars);

  return (
    <View style={[styles.card, { width }]}>
      {/* Badge "Nouveau !" */}
      {isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>{t('label_new')}</Text>
        </View>
      )}

      {/* Zone animation (200×120 px) */}
      <View style={styles.animContainer}>
        <RuleAnimation rule={rule} a11yLabel={a11yLabel} />
      </View>

      {/* Miniatures des éléments concernés */}
      <ElementChips
        elementIds={rule.elements.filter((v, i, a) => a.indexOf(v) === i)}
        size={32}
        style={styles.chips}
      />

      {/* Texte d'accessibilité / fallback */}
      <Text style={styles.a11yText} numberOfLines={2}>
        {a11yLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  newBadge: {
    backgroundColor: Colors.forest.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  newBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  animContainer: {
    width: 300,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chips: {
    marginTop: 4,
  },
  a11yText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
