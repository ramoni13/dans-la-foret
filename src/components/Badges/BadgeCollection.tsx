// ============================================================
// BADGECOLLECTION — collection des trophées (Progression v2, C8 / Lot 8)
// Filtres par rareté, groupement par famille (Solo, Journalier, Forestier, Duel, Herbier, Fidélité,
// Surprises, Trophée final). Les séries sont affichées par palier : bois, pierre, or, cristal.
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
  getTrophyTexts,
} from '../../constants/badges';
import { PROGRESSION_V2 } from '../../constants/featureFlags';
import {
  CHAPTERS,
  computeLevelProgress,
  getChapter,
  getChapterProgress,
  getChapterSeeds,
  getRankForLevel,
  getRankLabel,
} from '../../constants/progression';
import { TROPHY_MUSIC_UNLOCK_MAP } from '../../constants/music';
import { Colors } from '../../constants/colors';
import { BadgeCard } from './BadgeCard';
import { BadgeDetailModal } from './BadgeDetailModal';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

type FilterOption = 'all' | BadgeRarity | 'surprise';

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
  /** Si true, masque le RankPanel en bas (utile quand il est déjà affiché au-dessus) */
  hideRankPanel?: boolean;
}

// Clés i18n pour les filtres
const FILTER_KEYS: Record<FilterOption, string> = {
  all:      'badge_filter_all',
  bois:     'rarity_bois',
  pierre:   'rarity_pierre',
  or:       'rarity_or',
  cristal:  'rarity_cristal',
  surprise: 'badge_filter_surprise',
};

// Clés i18n pour les familles de trophées
const CATEGORY_KEYS: Record<BadgeCategory, string> = {
  solo:     'trophy_family_solo',
  daily:    'trophy_family_daily',
  onf:      'trophy_family_onf',
  duel:     'trophy_family_duel',
  herbier:  'trophy_family_herbier',
  fidelite: 'trophy_family_fidelite',
  surprise: 'trophy_family_surprise',
  final:    'trophy_family_final',
};

const CATEGORY_ORDER: BadgeCategory[] = [
  'solo', 'daily', 'onf', 'duel', 'herbier', 'fidelite', 'surprise', 'final',
];

// ── Panneau « Rang et chapitres » (Progression v2, C3 / D4) ──────────────────
// Le rang est le CHAPITRE en cours : plus de score de badges ni de points d'activité.

export interface RankPanelProps {
  earnedBadges: string[];
  language: string;
  t: (key: string, vars?: Record<string, string>) => string;
}

export const RankPanel: React.FC<RankPanelProps> = ({ language, t }) => {
  const challengeStars = usePlayerStore(s => s.challengeStars);
  const currentLevel = usePlayerStore(s => s.currentLevel);

  const progress = React.useMemo(() => computeLevelProgress(challengeStars), [challengeStars]);
  // PROGRESSION_V2 : niveau issu des étoiles ; sinon le niveau du joueur (ancien calcul).
  const level = PROGRESSION_V2 ? progress.currentLevel : currentLevel;
  const rank = getRankForLevel(level);
  const rankLabel = getRankLabel(rank, language);
  const chapter = getChapter(rank.chapterId);
  const chapterName = chapter ? t(chapter.nameKey) : '';
  const chapterProg = getChapterProgress(rank.chapterId, challengeStars, progress);
  const nextChapter = getChapter(rank.chapterId + 1);
  const nextRank = nextChapter ? getRankLabel(getRankForLevel(nextChapter.levels[0]), language) : null;
  const ratio = chapterProg.levelsTotal > 0 ? chapterProg.levelsDone / chapterProg.levelsTotal : 0;

  return (
    <View style={rankStyles.container}>
      <Text style={rankStyles.sectionTitle}>{t('rank_section_title')}</Text>

      {/* Rang courant = chapitre en cours */}
      <View
        style={rankStyles.scoreBox}
        accessible
        accessibilityLabel={t('rank_a11y_current', { rank: rankLabel, chapter: chapterName })}
      >
        <Text style={rankStyles.rankText}>{rank.emoji} {rankLabel}</Text>
        <Text style={rankStyles.scoreText}>
          {t('levels_chapter_header', { n: String(rank.chapterId), name: chapterName })}
        </Text>
        {nextRank ? (
          <>
            <Text style={rankStyles.nextText}>
              {t('rank_next_chapter', {
                done: String(chapterProg.levelsDone),
                total: String(chapterProg.levelsTotal),
                rank: nextRank,
              })}
            </Text>
            <View style={rankStyles.progressBar}>
              <View style={[rankStyles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </>
        ) : (
          <Text style={rankStyles.maxText}>{t('rank_max_reached')}</Text>
        )}
      </View>

      {/* Les 7 chapitres : rang, état, récompense de graines */}
      <Text style={rankStyles.pointsTitle}>{t('rank_chapters_title')}</Text>
      <View style={rankStyles.rankList}>
        {CHAPTERS.map((c, idx) => {
          const cp = getChapterProgress(c.id, challengeStars, progress);
          const isCurrent = cp.status === 'current';
          const isDone = cp.status === 'completed';
          const isLocked = cp.status === 'locked';
          const cRank = getRankForLevel(c.levels[0]);
          const seeds = getChapterSeeds(c);
          return (
            <View
              key={c.id}
              style={[
                rankStyles.rankRow,
                isCurrent && rankStyles.rankRowCurrent,
                idx < CHAPTERS.length - 1 && rankStyles.rankRowBorder,
              ]}
              accessible
              accessibilityLabel={`${getRankLabel(cRank, language)}, ${t(c.nameKey)}, ${t(
                isDone ? 'rank_chapter_done' : isCurrent ? 'rank_chapter_current' : 'rank_chapter_locked',
              )}`}
            >
              <Text style={[rankStyles.rankEmoji, isLocked && rankStyles.rankLocked]}>
                {isLocked ? '🔒' : c.emoji}
              </Text>
              <View style={rankStyles.rankInfo}>
                <Text style={[rankStyles.rankName, isCurrent && rankStyles.rankNameCurrent, isLocked && rankStyles.rankLocked]}>
                  {getRankLabel(cRank, language)}
                </Text>
                <Text style={rankStyles.rankMin}>
                  {t('levels_chapter_header', { n: String(c.id), name: t(c.nameKey) })}
                  {seeds > 0 ? `  ·  +${seeds} 🌱` : ''}
                </Text>
              </View>
              {isDone && <Text style={rankStyles.chapterDone}>✓</Text>}
              {isCurrent && (
                <View style={rankStyles.currentBadge}>
                  <Text style={rankStyles.currentBadgeText}>{t('badge_rank_label')}</Text>
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
    textAlign: 'center',
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
  chapterDone: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.forest.accent,
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
  hideRankPanel = false,
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
    if (activeFilter === 'surprise') return badge.category === 'surprise';
    // Filtrer par rareté (le palier d'une série détermine sa rareté)
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
        musicUnlockTrack={selectedBadge ? TROPHY_MUSIC_UNLOCK_MAP[selectedBadge.id] : undefined}
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
                const texts    = getTrophyTexts(badge, language, t);
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
                    musicUnlockTrackTitle={TROPHY_MUSIC_UNLOCK_MAP[badge.id]?.title}
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

        {/* Pavé système de rangs — visible en bas sauf si déjà affiché au-dessus */}
        {activeFilter === 'all' && !hideRankPanel && (
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
