// ============================================================
// BADGEPROGRESS INLINE — « Prochains trophées » (Progression v2, C8 / Lot 8)
// Affichée dans la VictoryModal après une victoire : les 3 trophées de série LES PLUS PROCHES, avec leur
// barre de progression. Il n'y a plus d'« objectif actif » à choisir : la liste est calculée toute seule
// (`getClosestTrophies`). Un trophée tout juste obtenu ce tour s'affiche avec ✓ et une barre verte.
// Animation « +N » séquentielle après la fin de l'animation des graines.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BADGE_MAP, BadgeRarity } from '../../constants/badges';
import { Colors } from '../../constants/colors';
import { TrophyProgress, getSeries } from '../../constants/trophies';
import { useT } from '../../i18n';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Un trophée proposé : progression actuelle + valeur AVANT la partie (pour l'animation +N). */
export interface NextTrophyItem extends TrophyProgress {
  /** Valeur avant la partie ; sert au « +N ». */
  previousValue: number;
}

interface BadgeProgressInlineProps {
  /** Les prochains trophées (3 au plus), calculés par `getClosestTrophies`. */
  trophies: NextTrophyItem[];
  /** Identifiants des trophées obtenus ce tour — affichés avec ✓ et barre verte. */
  obtainedBadgeIds?: string[];
  onPress?: () => void;
  /** Signal de fin de l'animation des graines : déclenche les +N séquentiels. */
  seedAnimDone?: boolean;
}

const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

// Délai entre chaque +N (ms)
const STAGGER_MS = 550;

// ── Animation +N ───────────────────────────────────────────────────────────────

const BadgePlusOne: React.FC<{ trigger: boolean; delta: number }> = ({ trigger, delta }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const playedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger || playedRef.current) return;
    playedRef.current = true;
    setVisible(true);
    opacityAnim.setValue(1);
    scaleAnim.setValue(0);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.4, damping: 4, stiffness: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.1, damping: 12, stiffness: 180, useNativeDriver: true }),
    ]).start();
    const tm = setTimeout(() => {
      Animated.timing(opacityAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setVisible(false));
    }, 1600);
    return () => clearTimeout(tm);
  }, [trigger]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.plusOne, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]} pointerEvents="none">
      <Text style={styles.plusOneText}>+{delta}</Text>
    </Animated.View>
  );
};

// ── Composant ──────────────────────────────────────────────────────────────────

export const BadgeProgressInline: React.FC<BadgeProgressInlineProps> = ({
  trophies, obtainedBadgeIds = [], onPress, seedAnimDone = true,
}) => {
  const t = useT();
  const obtained = new Set(obtainedBadgeIds);
  const [triggered, setTriggered] = useState(-1);

  const deltas = trophies.map(item => Math.max(0, item.current - item.previousValue));
  const countWithDelta = deltas.filter(d => d > 0).length;

  // Déclenche chaque +N avec un décalage, une fois les graines arrivées
  useEffect(() => {
    if (!seedAnimDone || countWithDelta === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < trophies.length; i++) timers.push(setTimeout(() => setTriggered(i), i * STAGGER_MS));
    return () => timers.forEach(clearTimeout);
  }, [seedAnimDone, trophies.length, countWithDelta]);

  if (trophies.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={styles.sectionLabel}>{t('trophy_next_title')}</Text>
      {trophies.map((item, index) => {
        const series = getSeries(item.seriesId);
        const def = BADGE_MAP[item.trophyId];
        if (!series || !def) return null;
        const isObtained = obtained.has(item.trophyId);
        const pct = isObtained ? 1 : item.percentage;
        const delta = deltas[index];
        const color = RARITY_COLORS[def.rarity] ?? Colors.ui.textLight;
        const name = t(series.nameKey);
        const target = String(item.target);
        return (
          <View
            key={item.trophyId}
            style={index > 0 ? styles.separator : undefined}
            accessible
            accessibilityLabel={t('trophy_next_a11y', {
              name, tier: String(item.tier), current: String(item.current), target,
            })}
          >
            <View style={styles.header}>
              <View style={styles.emojiWrapper}>
                <Text style={styles.emoji}>{series.emoji}</Text>
                {delta > 0 && <BadgePlusOne trigger={triggered >= index} delta={delta} />}
              </View>
              <View style={styles.labelBlock}>
                <Text style={styles.title} numberOfLines={1}>{name}</Text>
                <Text style={styles.desc} numberOfLines={1}>
                  {series.id === 'podium'
                    ? t(`trophy_podium_tier_${item.tier}`)
                    : t(series.descKey, { target })}
                </Text>
              </View>
              {isObtained
                ? <Text style={styles.obtained}>✓</Text>
                : <Text style={styles.counter}>{t('trophy_series_progress', { current: String(item.current), target })}</Text>}
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: isObtained ? '#4CAF50' : color }]} />
            </View>
          </View>
        );
      })}
      {onPress && <Text style={styles.cta}>{t('badges_see_all')}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.ui.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'visible' },
  emojiWrapper: { position: 'relative' },
  emoji: { fontSize: 22 },
  plusOne: {
    position: 'absolute',
    top: -14,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  plusOneText: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  labelBlock: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '700', color: Colors.forest.dark },
  desc: { fontSize: 11, color: Colors.ui.textLight },
  counter: { fontSize: 12, fontWeight: '700', color: Colors.ui.textLight },
  obtained: { fontSize: 18, fontWeight: '900', color: '#4CAF50' },
  bar: { height: 6, borderRadius: 3, backgroundColor: Colors.ui.border, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 3 },
  separator: { borderTopWidth: 1, borderTopColor: Colors.ui.border, paddingTop: 8 },
  cta: { fontSize: 11, color: Colors.forest.medium, textAlign: 'center', fontWeight: '700', marginTop: 4 },
});
