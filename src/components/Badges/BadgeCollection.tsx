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
} from '../../constants/badges';
import { Colors } from '../../constants/colors';
import { BadgeCard } from './BadgeCard';
import { BadgeDetailModal } from './BadgeDetailModal';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';
import { getBadgeTexts } from '../../constants/badges';

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
