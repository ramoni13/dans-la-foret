// ============================================================
// BADGEPROGRESS INLINE — 3 lignes de badges typées (Track system)
// Affichée dans la VictoryModal après une victoire.
// Chaque ligne correspond à une track : Performance / Persévérance / Exploration.
// Animation "+N" séquentielle après la fin de l'animation des graines.
// ============================================================

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';

import { BADGE_MAP, BadgeRarity, getBadgeTexts } from '../../constants/badges';
import { BadgeProgress } from '../../core/engine/badgeEngine';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

/**
 * Décompose un challengeId du type "niveau_3_007" en "Niveau 3 · Défi 7".
 * Retourne null si le format n'est pas reconnu.
 */
function formatChallengeTarget(challengeId: string | null | undefined): string | null {
  if (!challengeId) return null;
  const match = challengeId.match(/^niveau_(\d+)_(\d+)$/);
  if (!match) return null;
  return `Niv. ${match[1]} · Défi ${parseInt(match[2], 10)}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrackBadgeProgressMap {
  performance:  BadgeProgress | null;
  perseverance: BadgeProgress | null;
  exploration:  BadgeProgress | null;
}

interface BadgeProgressInlineProps {
  /**
   * Progressions par track — structure typée à 3 slots.
   * Remplace l'ancien closestBadges[].
   */
  trackBadges?: TrackBadgeProgressMap;
  /**
   * Compat descendante : ancien tableau closestBadges[].
   * Utilisé si trackBadges n'est pas fourni.
   */
  closestBadges?: BadgeProgress[];
  /** IDs des badges obtenus ce tour — affichés avec ✓, barre verte et animation +N */
  obtainedBadgeIds?: string[];
  /** IDs des nouveaux objectifs injectés par l'auto-avance — affichés avec badge "Nouveau" */
  newGoalBadgeIds?: string[];
  onPress?: () => void;
  /**
   * Signal de fin de l'animation des graines (SeedFlyAnimation terminée).
   * Quand passe à true, déclenche les +N séquentiels sur chaque track.
   */
  seedAnimDone?: boolean;
}

const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

// Délai entre chaque +N de track (ms)
const TRACK_STAGGER_MS = 550;

// ── Composant animation +N ─────────────────────────────────────────────────────

interface BadgePlusOneProps {
  /** Déclenche l'animation quand passe à true */
  trigger: boolean;
  /** Delta à afficher (ex: +2, +3). Défaut = 1 */
  delta?: number;
}

const BadgePlusOne: React.FC<BadgePlusOneProps> = ({ trigger, delta = 1 }) => {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const playedRef   = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger || playedRef.current) return;
    playedRef.current = true;
    setVisible(true);
    opacityAnim.setValue(1);
    scaleAnim.setValue(0);

    // Pop : 0 → 1.4 (overshoot) → 1.1 (settle), puis fade après 1600ms
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.4,
        damping: 4,
        stiffness: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out après 1600ms, sur 500ms
    setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, 1600);
  }, [trigger]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.plusOne,
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.plusOneText}>+{delta}</Text>
    </Animated.View>
  );
};

// ── Ligne de badge ─────────────────────────────────────────────────────────────

interface TrackRowProps {
  trackLabel: string;
  item: BadgeProgress;
  isObtained: boolean;
  isNew: boolean;
  language: string;
  /** true = l'animation +N doit se déclencher sur cette ligne */
  triggerAnim: boolean;
}

const TrackRow: React.FC<TrackRowProps> = ({
  trackLabel, item, isObtained, isNew, language, triggerAnim,
}) => {
  const t = useT();
  const badge = BADGE_MAP[item.badgeId];
  if (!badge) return null;
  const badgeTexts  = getBadgeTexts(badge, language as any);
  const rarityColor = RARITY_COLORS[badge.rarity] ?? Colors.ui.textLight;
  const relCurrent  = isNew ? 0 : item.currentValue;
  const relTarget   = Math.max(1, item.targetValue);
  const pct         = isObtained ? 1 : isNew ? 0 : Math.min(relCurrent / relTarget, 1);

  // Delta pour +N :
  // - badge obtenu ce tour : delta = étapes restantes depuis previousValue jusqu'à target
  // - progression ordinaire : delta = current - previousValue
  const prevValue = item.previousValue ?? item.currentValue;
  const delta = isObtained
    ? Math.max(1, item.targetValue - prevValue)
    : Math.max(0, item.currentValue - prevValue);

  // Le +N s'affiche uniquement s'il y a un delta réel ou si c'est une obtention
  const hasDelta = isObtained || delta > 0;

  return (
    <View>
      {/* Header de track */}
      <Text style={styles.trackLabel}>{trackLabel}</Text>
      <View style={styles.header}>
        {/* Emoji */}
        <View style={styles.emojiWrapper}>
          <Text style={styles.emoji}>{badge.emoji}</Text>
        </View>
        {/* Bulle +N positionnée au niveau du compteur 2/5 */}
        {hasDelta && (
          <BadgePlusOne
            trigger={triggerAnim}
            delta={delta > 0 ? delta : 1}
          />
        )}
        <View style={styles.labelBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{badgeTexts.label}</Text>
            {isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{t('label_new')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.desc} numberOfLines={1}>{badgeTexts.description}</Text>
        </View>
        {isObtained
          ? <Text style={styles.obtained}>✓</Text>
          : <Text style={styles.counter}>{relCurrent}/{relTarget}</Text>
        }
      </View>
      {/* Défi cible pour amelioration_cycle / amelioration_fusee */}
      {(() => {
        const label = formatChallengeTarget(item.targetChallengeId);
        if (!label || isObtained) return null;
        return <Text style={styles.challengeTarget}>{label}</Text>;
      })()}
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${pct * 100}%`, backgroundColor: isObtained ? '#4CAF50' : rarityColor },
          ]}
        />
      </View>
    </View>
  );
};

// ── Composant principal ────────────────────────────────────────────────────────

export const BadgeProgressInline: React.FC<BadgeProgressInlineProps> = ({
  trackBadges,
  closestBadges = [],
  obtainedBadgeIds = [],
  newGoalBadgeIds = [],
  onPress,
  seedAnimDone = false,
}) => {
  const t = useT();
  const language = usePlayerStore(s => s.language);

  const obtainedSet = new Set(obtainedBadgeIds);
  const newGoalSet  = new Set(newGoalBadgeIds);

  // Index de la track dont le +N est actif (-1 = aucun déclenché)
  const [triggeredIndex, setTriggeredIndex] = useState(-1);

  // ── Séquencement des +N après fin animation graines ──────────────────────────
  // Se déclenche quand seedAnimDone passe à true, OU quand trackBadges arrive
  // après que seedAnimDone était déjà true (badge complété → nouveau badge injecté).
  useEffect(() => {
    if (!seedAnimDone) return;

    setTriggeredIndex(-1);

    // On détermine combien de tracks ont un delta à afficher
    let count = 0;
    if (trackBadges) {
      const keys: Array<'performance' | 'perseverance' | 'exploration'> =
        ['performance', 'perseverance', 'exploration'];
      keys.forEach(k => { if (trackBadges[k] !== null) count++; });
    } else {
      count = closestBadges.length;
    }

    // Déclencher chaque track avec TRACK_STAGGER_MS entre elles
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      const delay = i * TRACK_STAGGER_MS;
      timers.push(setTimeout(() => setTriggeredIndex(i), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [seedAnimDone, trackBadges, closestBadges]);

  // ── Mode tracks typées ───────────────────────────────────────────────────────
  if (trackBadges) {
    const trackEntries: Array<{ key: 'performance' | 'perseverance' | 'exploration'; label: string }> = [
      { key: 'performance',  label: t('track_performance') },
      { key: 'perseverance', label: t('track_perseverance') },
      { key: 'exploration',  label: t('track_exploration') },
    ];

    const visibleRows = trackEntries.filter(e => trackBadges[e.key] !== null);
    if (visibleRows.length === 0) return null;

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={onPress ? 0.75 : 1}
      >
        {visibleRows.map((entry, index) => {
          const item = trackBadges[entry.key]!;
          return (
            <View key={entry.key} style={index > 0 ? styles.separator : undefined}>
              <TrackRow
                trackLabel={entry.label}
                item={item}
                isObtained={obtainedSet.has(item.badgeId)}
                isNew={newGoalSet.has(item.badgeId)}
                language={language}
                triggerAnim={triggeredIndex >= index}
              />
            </View>
          );
        })}
        {onPress && (
          <Text style={styles.cta}>{t('badges_see_all')}</Text>
        )}
      </TouchableOpacity>
    );
  }

  // ── Mode compat descendante (closestBadges[]) ────────────────────────────────
  if (closestBadges.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {closestBadges.map((item, index) => {
        const badge = BADGE_MAP[item.badgeId];
        if (!badge) return null;
        const badgeTexts  = getBadgeTexts(badge, language);
        const isObtained  = obtainedSet.has(item.badgeId);
        const isNew       = newGoalSet.has(item.badgeId);
        const rarityColor = RARITY_COLORS[badge.rarity] ?? Colors.ui.textLight;
        const relCurrent  = isNew ? 0 : item.currentValue;
        const relTarget   = Math.max(1, item.targetValue);
        const pct         = isObtained ? 1 : isNew ? 0 : Math.min(relCurrent / relTarget, 1);
        const prevValue   = item.previousValue ?? item.currentValue;
        const delta       = isObtained
          ? Math.max(1, item.targetValue - prevValue)
          : Math.max(0, item.currentValue - prevValue);
        const hasDelta    = isObtained || delta > 0;

        return (
          <View key={item.badgeId} style={index > 0 ? styles.separator : undefined}>
            <View style={styles.header}>
              <View style={styles.emojiWrapper}>
                <Text style={styles.emoji}>{badge.emoji}</Text>
                {hasDelta && (
                  <BadgePlusOne
                    trigger={triggeredIndex >= index}
                    delta={delta > 0 ? delta : 1}
                  />
                )}
              </View>
              <View style={styles.labelBlock}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{badgeTexts.label}</Text>
                  {isNew && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>{t('label_new')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.desc} numberOfLines={1}>{badgeTexts.description}</Text>
              </View>
              {isObtained
                ? <Text style={styles.obtained}>✓</Text>
                : <Text style={styles.counter}>{relCurrent}/{relTarget}</Text>
              }
            </View>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct * 100}%`, backgroundColor: isObtained ? '#4CAF50' : rarityColor },
                ]}
              />
            </View>
          </View>
        );
      })}

      {onPress && (
        <Text style={styles.cta}>{t('badges_see_all')}</Text>
      )}
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
  trackLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'visible',
  },
  emojiWrapper: {
    position: 'relative',
  },
  emoji: {
    fontSize: 22,
  },
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
  plusOneText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
    flexShrink: 1,
  },
  newBadge: {
    backgroundColor: '#2E7D32',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  desc: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  challengeTarget: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.forest.medium,
    marginTop: 3,
    marginBottom: 1,
  },
  counter: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.textLight,
  },
  obtained: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4CAF50',
  },
  separator: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  bar: {
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  cta: {
    fontSize: 11,
    color: Colors.forest.medium,
    fontWeight: '600',
    textAlign: 'right',
  },
});
