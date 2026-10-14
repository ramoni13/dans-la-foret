// ============================================================
// BADGECOLLECTION — Vue grille complète de tous les badges
// Filtres par rareté, groupement par catégorie
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

import {
  BADGE_DEFINITIONS,
  BadgeCategory,
  BadgeDefinition,
  BadgeRarity,
  TOTAL_NON_SECRET_BADGES,
  TOTAL_SECRET_BADGES,
  getBadgeTexts,
  RANK_DEFINITIONS,
  RARITY_POINTS,
  MAX_BADGE_SCORE,
  getBadgeScore,
  getRank,
  getNextRank,
} from '../../constants/badges';
import { BADGE_MUSIC_UNLOCK_MAP } from '../../constants/music';
import { Colors } from '../../constants/colors';
import { BadgeCard } from './BadgeCard';
import { BadgeDetailModal } from './BadgeDetailModal';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

type FilterOption = 'all' | BadgeRarity | 'secret' | 'saisonnier';

interface BadgeCollectionProps {
  earnedBadges: string[];
  /** Optionnel : callback externe en plus du modal de détail intégré */
  onBadgePress?: (badgeId: string) => void;
  /** earnedAt map: badgeId → ISO date string */
  earnedAtMap?: Record<string, string>;
  /** Progression map: badgeId → 0–1 */
  progressMap?: Record<string, number>;
  /** Labels de progression: badgeId → ex: "8/10" */
  progressLabelMap?: Record<string, string>;
}

// Clés i18n pour les filtres de rareté
const FILTER_KEYS: Record<FilterOption, string> = {
  all:        'badge_filter_all',
  bois:       'rarity_bois',
  pierre:     'rarity_pierre',
  or:         'rarity_or',
  cristal:    'rarity_cristal',
  secret:     'badge_filter_secret',
  saisonnier: 'badge_filter_seasonal',
};

// Clés i18n pour les catégories
const CATEGORY_KEYS: Record<BadgeCategory, string> = {
  vitesse:      'cat_vitesse',
  precision:    'cat_precision',
  regularite:   'cat_regularite',
  social:       'cat_social',
  amelioration: 'cat_amelioration',
  exploration:  'cat_exploration',
  secret:       'cat_secret',
  saisonnier:   'cat_saisonnier',
};

const CATEGORY_ORDER: BadgeCategory[] = [
  'vitesse', 'precision', 'regularite', 'social',
  'amelioration', 'exploration', 'saisonnier', 'secret',
];

// ── Panneau des rangs forestiers ─────────────────────────────────────────────

const RARITY_ROWS: { key: BadgeRarity; color: string; labelKey: string }[] = [
  { key: 'bois',    color: '#8B5E3C', labelKey: 'rank_points_bois'    },
  { key: 'pierre',  color: '#78909C', labelKey: 'rank_points_pierre'  },
  { key: 'or',      color: '#F9A825', labelKey: 'rank_points_or'      },
  { key: 'cristal', color: '#00BCD4', labelKey: 'rank_points_cristal' },
];

interface RankPanelProps {
  earnedBadges: string[];
  language: string;
  t: (key: string, vars?: Record<string, string>) => string;
}

const RankPanel: React.FC<RankPanelProps> = ({ earnedBadges, language, t }) => {
  const score    = getBadgeScore(earnedBadges);
  const rank     = getRank(score);
  const nextRank = getNextRank(score);

  const rankLabel = language === 'en' ? rank.labelEn : rank.label;

  return (
    <View style={rankStyles.container}>
      {/* Titre section */}
      <Text style={rankStyles.sectionTitle}>{t('rank_section_title')}</Text>

      {/* Bloc score joueur */}
      <View style={rankStyles.scoreBox}>
        <Text style={rankStyles.scoreText}>
          {t('rank_your_score', { score: String(score), max: String(MAX_BADGE_SCORE) })}
        </Text>
        <Text style={rankStyles.rankText}>
          {rank.emoji} {rankLabel}
        </Text>
        {nextRank ? (
          <Text style={rankStyles.nextText}>
            {t('rank_next_rank', {
              emoji: nextRank.emoji,
              label: language === 'en' ? nextRank.labelEn : nextRank.label,
              pts: String(nextRank.minScore),
            })}
          </Text>
        ) : (
          <Text style={rankStyles.maxText}>{t('rank_max_reached')}</Text>
        )}
        {/* Barre de progression vers le rang suivant */}
        {nextRank && (
          <View style={rankStyles.progressBar}>
            <View style={[rankStyles.progressFill, {
              width: `${Math.min(100, (score / nextRank.minScore) * 100)}%`,
            }]} />
          </View>
        )}
      </View>

      {/* Barème des points */}
      <Text style={rankStyles.pointsTitle}>{t('rank_points_title')}</Text>
      <View style={rankStyles.pointsGrid}>
        {RARITY_ROWS.map(row => (
          <View key={row.key} style={rankStyles.pointsRow}>
            <View style={[rankStyles.rarityDot, { backgroundColor: row.color }]} />
            <Text style={rankStyles.pointsLabel}>{t(row.labelKey)}</Text>
            <Text style={rankStyles.pointsValue}>+{RARITY_POINTS[row.key]}</Text>
          </View>
        ))}
      </View>

      {/* Liste de tous les rangs */}
      <View style={rankStyles.rankList}>
        {RANK_DEFINITIONS.map((r, idx) => {
          const isCurrentRank = r.id === rank.id;
          const isUnlocked    = score >= r.minScore;
          const label         = language === 'en' ? r.labelEn : r.label;
          return (
            <View
              key={r.id}
              style={[
                rankStyles.rankRow,
                isCurrentRank && rankStyles.rankRowCurrent,
                idx < RANK_DEFINITIONS.length - 1 && rankStyles.rankRowBorder,
              ]}
            >
              <Text style={[rankStyles.rankEmoji, !isUnlocked && rankStyles.rankLocked]}>
                {isUnlocked ? r.emoji : '🔒'}
              </Text>
              <View style={rankStyles.rankInfo}>
                <Text style={[rankStyles.rankName, isCurrentRank && rankStyles.rankNameCurrent, !isUnlocked && rankStyles.rankLocked]}>
                  {label}
                </Text>
                <Text style={rankStyles.rankMin}>{r.minScore} pts</Text>
              </View>
              {isCurrentRank && (
                <View style={rankStyles.currentBadge}>
                  <Text style={rankStyles.currentBadgeText}>ton rang</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const rankStyles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 32,
    marginHorizontal: 4,
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  scoreBox: {
    backgroundColor: Colors.forest.dark + '0D',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  rankText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  nextText: {
    fontSize: 11,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  maxText: {
    fontSize: 12,
    color: Colors.forest.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.forest.medium,
    borderRadius: 3,
  },
  pointsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  pointsGrid: {
    gap: 6,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rarityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pointsLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  rankList: {
    gap: 0,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: Colors.ui.background,
  },
  rankRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  rankRowCurrent: {
    backgroundColor: Colors.forest.dark + '10',
  },
  rankEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  rankLocked: {
    opacity: 0.35,
  },
  rankInfo: {
    flex: 1,
    gap: 1,
  },
  rankName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.text,
  },
  rankNameCurrent: {
    color: Colors.forest.dark,
  },
  rankMin: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  currentBadge: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});

export const BadgeCollection: React.FC<BadgeCollectionProps> = ({
  earnedBadges,
  onBadgePress,
  earnedAtMap = {},
  progressMap = {},
  progressLabelMap = {},
}) => {
  const t = useT();
  const language = usePlayerStore(state => state.language);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);

  const handleBadgePress = (badge: BadgeDefinition) => {
    setSelectedBadge(badge);
    onBadgePress?.(badge.id);
  };

  const earnedSet = new Set(earnedBadges);
  const earnedNonSecret = BADGE_DEFINITIONS.filter(b => !b.isSecret && earnedSet.has(b.id)).length;
  const earnedSecret    = BADGE_DEFINITIONS.filter(b => b.isSecret && earnedSet.has(b.id)).length;
  const globalPct       = TOTAL_NON_SECRET_BADGES > 0 ? earnedNonSecret / TOTAL_NON_SECRET_BADGES : 0;

  // Filtrage
  const filteredBadges = BADGE_DEFINITIONS.filter(badge => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'secret') return badge.isSecret;
    if (activeFilter === 'saisonnier') return badge.isSeasonal;
    // Filtrer par rareté (hors secrets et saisonniers dans les autres onglets)
    return badge.rarity === activeFilter && !badge.isSecret;
  });

  // Groupement par catégorie
  const byCategory: Partial<Record<BadgeCategory, typeof filteredBadges>> = {};
  for (const badge of filteredBadges) {
    if (!byCategory[badge.category]) byCategory[badge.category] = [];
    byCategory[badge.category]!.push(badge);
  }

  const categories = CATEGORY_ORDER.filter(cat => byCategory[cat]?.length);

  return (
    <View style={styles.container}>
      {/* Modal de détail — rendu au niveau du composant pour être dans le même layer */}
      <BadgeDetailModal
        badge={selectedBadge}
        earned={selectedBadge ? earnedSet.has(selectedBadge.id) : false}
        earnedAt={selectedBadge ? earnedAtMap[selectedBadge.id] : undefined}
        progress={selectedBadge ? (progressMap[selectedBadge.id] ?? 0) : 0}
        progressLabel={selectedBadge ? progressLabelMap[selectedBadge.id] : undefined}
        onClose={() => setSelectedBadge(null)}
        musicUnlockTrack={selectedBadge ? BADGE_MUSIC_UNLOCK_MAP[selectedBadge.id] : undefined}
      />
      {/* Header stats */}
      <View style={styles.header}>
        <Text style={styles.counter}>
          {t('badge_counter', { earned: String(earnedNonSecret), total: String(TOTAL_NON_SECRET_BADGES) })}
        </Text>
        {earnedSecret > 0 && (
          <Text style={styles.secretCounter}>
            {t(earnedSecret > 1 ? 'badge_secret_counter_plural' : 'badge_secret_counter', { count: String(earnedSecret) })}
          </Text>
        )}
        <View style={styles.globalBar}>
          <View style={[styles.globalBarFill, { width: `${globalPct * 100}%` }]} />
        </View>
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {(Object.keys(FILTER_KEYS) as FilterOption[]).map(key => (
          <TouchableOpacity
            key={key}
            style={[styles.filterBtn, activeFilter === key && styles.filterBtnActive]}
            onPress={() => setActiveFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, activeFilter === key && styles.filterTextActive]}>
              {t(FILTER_KEYS[key])}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grille par catégorie */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.grid}>
        {categories.map(cat => (
          <View key={cat} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{t(CATEGORY_KEYS[cat])}</Text>
            <View style={styles.badgeRow}>
              {byCategory[cat]!.map(badge => {
                const isEarned = earnedSet.has(badge.id);
                const texts    = getBadgeTexts(badge, language);
                return (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    earned={isEarned}
                    progress={progressMap[badge.id]}
                    progressLabel={progressLabelMap[badge.id]}
                    earnedAt={earnedAtMap[badge.id]}
                    size="normal"
                    label={texts.label}
                    onPress={() => handleBadgePress(badge)}
                    musicUnlockTrackTitle={BADGE_MUSIC_UNLOCK_MAP[badge.id]?.title}
                  />
                );
              })}
            </View>
          </View>
        ))}

        {/* Ligne "X badges secrets à découvrir" */}
        {activeFilter === 'all' && earnedSecret < TOTAL_SECRET_BADGES && (
          <View style={styles.secretHint}>
            <Text style={styles.secretHintText}>
              {(() => {
                const remaining = TOTAL_SECRET_BADGES - earnedSecret;
                return t(remaining > 1 ? 'badge_secrets_hint_plural' : 'badge_secrets_hint', { count: String(remaining) });
              })()}
            </Text>
          </View>
        )}

        {/* Pavé système de rangs — toujours visible en bas */}
        {activeFilter === 'all' && (
          <RankPanel earnedBadges={earnedBadges} language={language} t={t} />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  header: {
    padding: 16,
    gap: 6,
  },
  counter: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  secretCounter: {
    fontSize: 12,
    color: Colors.badges.secret,
    fontWeight: '600',
  },
  globalBar: {
    height: 8,
    backgroundColor: Colors.ui.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  globalBarFill: {
    height: '100%',
    backgroundColor: Colors.forest.accent,
    borderRadius: 4,
  },
  filterScroll: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  filterContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  filterBtnActive: {
    backgroundColor: Colors.forest.medium,
    borderColor: Colors.forest.medium,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  filterTextActive: {
    color: '#fff',
  },
  grid: {
    flex: 1,
    paddingHorizontal: 12,
  },
  categorySection: {
    marginTop: 16,
    gap: 10,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
    marginLeft: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secretHint: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.badges.secretBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.badges.secret + '40',
    borderStyle: 'dashed',
  },
  secretHintText: {
    fontSize: 13,
    color: Colors.badges.secret,
    fontWeight: '600',
    textAlign: 'center',
  },
});
