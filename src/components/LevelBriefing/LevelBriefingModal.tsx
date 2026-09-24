// ============================================================
// LevelBriefingModal — Écran de briefing affiché avant chaque défi
//
// Mode RÈGLES : quand newRules.length > 0
//   → FlatList swipeable, une RuleCard par nouvelle règle
//   → dernière carte = BoardSummary
//   → bouton "Jouer" visible uniquement sur la dernière carte
//
// Mode RECAP : quand newRules.length === 0
//   → directement BoardSummary + bouton "Jouer"
//
// Fermeture : tap explicite sur "Jouer" → appelle onClose()
// onClose() dans [challengeId].tsx appelle game.startTimer()
// ============================================================

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Challenge } from '../../core/models/Challenge';
import { LevelMeta } from '../../data/levelMeta';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { RuleCard } from './RuleCard';
import { BoardSummary } from './BoardSummary';

interface LevelBriefingModalProps {
  challenge: Challenge;
  levelMeta: LevelMeta;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LevelBriefingModal: React.FC<LevelBriefingModalProps> = ({
  challenge,
  levelMeta,
  onClose,
}) => {
  const t = useT();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const hasNewRules = levelMeta.newRules.length > 0;
  const isExpertMode = challenge.level === 'niveau_15';

  // Chaque "page" = une RuleCard (nouvelle règle), puis la BoardSummary comme dernière
  // En mode RECAP : une seule page (BoardSummary)
  type Page =
    | { kind: 'rule'; index: number }
    | { kind: 'summary' };

  const pages: Page[] = hasNewRules
    ? [
        ...levelMeta.newRules.map((_, i) => ({ kind: 'rule' as const, index: i })),
        { kind: 'summary' as const },
      ]
    : [{ kind: 'summary' as const }];

  const totalPages = pages.length;
  const [currentPage, setCurrentPage] = useState(0);

  const isLastPage = currentPage === totalPages - 1;

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(Math.min(Math.max(page, 0), totalPages - 1));
  }, [totalPages]);

  const goNext = useCallback(() => {
    if (isLastPage) {
      onClose();
    } else {
      const next = currentPage + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentPage(next);
    }
  }, [isLastPage, currentPage, onClose]);

  const levelNumber = levelMeta.levelNumber;

  const renderPage = ({ item, index }: { item: Page; index: number }) => {
    if (item.kind === 'rule') {
      const rule = levelMeta.newRules[item.index];
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <RuleCard
            rule={rule}
            isNew
            width={SCREEN_WIDTH - 32}
          />
        </View>
      );
    }
    // Summary page
    return (
      <View style={[styles.page, { width: SCREEN_WIDTH }]}>
        <BoardSummary
          challenge={challenge}
          levelMeta={levelMeta}
          isExpertMode={isExpertMode}
        />
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
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.levelTitle}>
          {t('level_prefix')} {levelNumber}
        </Text>
        <View style={styles.headerRight}>
          {totalPages > 1 && (
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
          )}
          {/* ── Bouton fermer ── */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Fermer"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Séparateur ── */}
      <View style={styles.divider} />

      {/* ── Contenu : FlatList de pages ── */}
      <View style={styles.content}>
        {totalPages === 1 ? (
          // Mode recap : pas besoin de FlatList
          <View style={styles.singlePage}>
            <BoardSummary
              challenge={challenge}
              levelMeta={levelMeta}
              isExpertMode={isExpertMode}
            />
          </View>
        ) : (
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
        )}
      </View>

      {/* ── Séparateur ── */}
      <View style={styles.divider} />

      {/* ── Navigation + bouton Jouer ── */}
      <View style={styles.footer}>
        {/* Indicateur swipe (si pas la dernière page) */}
        {!isLastPage && totalPages > 1 && (
          <Text style={styles.swipeHint}>← {t('briefing_rules_title')} →</Text>
        )}

        {/* Bouton Jouer (toujours visible sur la dernière page) */}
        {isLastPage && (
          <TouchableOpacity
            style={styles.playBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.playBtnText}>{t('btn_play')} ▶</Text>
          </TouchableOpacity>
        )}

        {/* Bouton "Suivant" sur les pages intermédiaires */}
        {!isLastPage && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={goNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>→</Text>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: Colors.forest.accent,
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
  singlePage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
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
    backgroundColor: Colors.forest.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  playBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.forest.dark,
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
