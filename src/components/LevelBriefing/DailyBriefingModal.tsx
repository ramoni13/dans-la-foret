// ============================================================
// DailyBriefingModal — Ecran de briefing pour le defi du jour
//
// Page 0 : Regle champignon — cases centrales (center_only)
// Page 1 : Regle champignon — pas de voisins (no_same_neighbor)
// Page 2 : Recap du defi (elements, contraintes, regles daily)
//
// Les pages 0 et 1 utilisent RuleCard + animations exactement
// comme LevelBriefingModal.
//
// Fermeture : tap "Jouer" sur la derniere page → onClose()
// ============================================================

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { ElementChips } from './ElementChips';
import { RuleCard } from './RuleCard';
import { Challenge } from '../../core/models/Challenge';
import { RuleCard as RuleCardData } from '../../data/levelMeta';

interface DailyBriefingModalProps {
  challenge: Challenge;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Regles champignon statiques (comme les RuleCard de levelMeta) ─────────────

const rCenterOnly: RuleCardData = {
  id: 'center_only_champignon',
  type: 'center_only',
  elements: ['champignon'],
  i18nKey: 'daily_briefing_rule_center',
};

const rNoSameChampignon: RuleCardData = {
  id: 'no_same_champignon',
  type: 'no_same_neighbor',
  elements: ['champignon', 'champignon'],
  i18nKey: 'daily_briefing_rule_no_neighbor',
};

// ── Composant ────────────────────────────────────────────────────────────────

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  challenge,
  onClose,
}) => {
  const t = useT();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const TOTAL_PAGES = 3;
  const [currentPage, setCurrentPage] = useState(0);
  const isLastPage = currentPage === TOTAL_PAGES - 1;

  const pages = [0, 1, 2];

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(Math.min(Math.max(page, 0), TOTAL_PAGES - 1));
  }, []);

  const goNext = useCallback(() => {
    if (isLastPage) {
      onClose();
    } else {
      const next = currentPage + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentPage(next);
    }
  }, [isLastPage, currentPage, onClose]);

  // Elements uniques presents dans le defi
  const elementIds = React.useMemo(() => {
    const ids = new Set<string>();
    challenge.availableTokens.forEach(tok => ids.add(tok.elementId));
    challenge.fixedPlacements.forEach(fp => ids.add(fp.elementId));
    return Array.from(ids);
  }, [challenge]);

  const renderPage = ({ item }: { item: number }) => {
    // ── Page 0 : center_only ────────────────────────────────────────────────
    if (item === 0) {
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.newBadgeRow}>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('daily_briefing_new_element')}</Text>
            </View>
          </View>
          <RuleCard
            rule={rCenterOnly}
            isNew
            width={SCREEN_WIDTH - 32}
          />
        </View>
      );
    }

    // ── Page 1 : no_same_neighbor ────────────────────────────────────────────
    if (item === 1) {
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <RuleCard
            rule={rNoSameChampignon}
            isNew={false}
            width={SCREEN_WIDTH - 32}
          />
        </View>
      );
    }

    // ── Page 2 : Recap du defi ───────────────────────────────────────────────
    return (
      <View style={[styles.page, { width: SCREEN_WIDTH }]}>
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Titre */}
          <Text style={styles.recapTitle}>{t('daily_briefing_title')}</Text>
          <Text style={styles.recapSubtitle}>{t('daily_briefing_board')}</Text>

          {/* Elements du defi */}
          <Text style={styles.sectionLabel}>{t('daily_briefing_elements')}</Text>
          <ElementChips elementIds={elementIds} size={40} style={styles.chips} />

          {/* Regles speciales du daily */}
          <View style={styles.dailyRulesContainer}>
            <View style={styles.dailyRule}>
              <Text style={styles.dailyRuleIcon}>{'\u26A1'}</Text>
              <Text style={styles.dailyRuleText}>{t('daily_briefing_single_validation')}</Text>
            </View>
            <View style={styles.dailyRule}>
              <Text style={styles.dailyRuleIcon}>{'\uD83D\uDEAB'}</Text>
              <Text style={styles.dailyRuleText}>{t('daily_briefing_no_bonus')}</Text>
            </View>
            <View style={styles.dailyRule}>
              <Text style={styles.dailyRuleIcon}>{'\uD83C\uDF0D'}</Text>
              <Text style={styles.dailyRuleText}>{t('daily_briefing_same_challenge')}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('daily_title')}</Text>
          <View style={styles.headerRight}>
            {/* Dots de pagination */}
            <View style={styles.dots}>
              {pages.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentPage && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            {/* Bouton fermer */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Fermer"
            >
              <Text style={styles.closeBtnText}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Separateur */}
        <View style={styles.divider} />

        {/* Contenu : FlatList paginee */}
        <View style={styles.content}>
          <FlatList
            ref={flatListRef}
            data={pages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderPage}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            snapToInterval={SCREEN_WIDTH}
            decelerationRate="fast"
            bounces={false}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />
        </View>

        {/* Separateur */}
        <View style={styles.divider} />

        {/* Footer */}
        <View style={styles.footer}>
          {!isLastPage && (
            <Text style={styles.swipeHint}>{'\u2190'} Glisser pour voir la suite {'\u2192'}</Text>
          )}

          {isLastPage && (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.playBtnText}>{t('btn_play')} {'\u25B6'}</Text>
            </TouchableOpacity>
          )}

          {!isLastPage && (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={goNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>{'\u2192'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 58, 26, 0.97)',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D4A017',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#D4A017',
    width: 14,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pageContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 20,
    flexGrow: 1,
  },

  // ── Page 0 : badge "Nouvel element" au-dessus de la RuleCard ─────────────
  newBadgeRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  newBadge: {
    backgroundColor: '#D4A017',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  newBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },

  // ── Page 2 : Recap ───────────────────────────────────────────────────────
  recapTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D4A017',
    textAlign: 'center',
  },
  recapSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chips: {
    paddingHorizontal: 8,
  },
  dailyRulesContainer: {
    gap: 12,
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dailyRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailyRuleIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  dailyRuleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  swipeHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
  playBtn: {
    flex: 1,
    backgroundColor: '#D4A017',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  playBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  nextBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  nextBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
