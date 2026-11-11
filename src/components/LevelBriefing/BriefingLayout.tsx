// ============================================================
// BriefingLayout — Coque commune de tous les briefings de défi
// (Solo, Journalier, Forestier)
//
// Porte tout ce qui doit être IDENTIQUE d'un mode à l'autre :
//   - en-tête (titre, points de pagination, bouton fermer 44 px),
//   - pagination horizontale,
//   - pied de page (indication de glissement, bouton « suivant »,
//     bouton « Jouer » sur la dernière page).
// Seules la couleur d'accent et les pages changent selon le mode.
//
// Fermeture : tap sur « Jouer » (dernière page) ou sur ✕ → onClose().
// ============================================================

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../i18n';

export interface BriefingTheme {
  /** Couleur du fond (semi-opaque). */
  overlay: string;
  /** Couleur du titre d'en-tête et du point de page actif. */
  accent: string;
  /** Fond du bouton « Jouer ». */
  cta: string;
  /** Texte du bouton « Jouer » (contraste ≥ 4,5:1 avec `cta`). */
  ctaText: string;
  /** Bordure optionnelle du bouton « Jouer ». */
  ctaBorder?: string;
}

interface BriefingLayoutProps<T> {
  title: string;
  theme: BriefingTheme;
  pages: T[];
  renderPage: (item: T, index: number) => React.ReactNode;
  onClose: () => void;
}

export function BriefingLayout<T>({
  title,
  theme,
  pages,
  renderPage,
  onClose,
}: BriefingLayoutProps<T>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<T>>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages - 1;

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setCurrentPage(Math.min(Math.max(page, 0), totalPages - 1));
    },
    [pageWidth, totalPages],
  );

  const goNext = useCallback(() => {
    if (isLastPage) {
      onClose();
      return;
    }
    const next = currentPage + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentPage(next);
  }, [isLastPage, currentPage, onClose]);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: theme.overlay,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* ── En-tête ── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.accent }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.headerRight}>
            {totalPages > 1 && (
              <View
                style={styles.dots}
                accessible
                accessibilityLabel={t('briefing_page_a11y', {
                  current: String(currentPage + 1),
                  total: String(totalPages),
                })}
              >
                {pages.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === currentPage && [styles.dotActive, { backgroundColor: theme.accent }],
                    ]}
                  />
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common_close')}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Contenu ── */}
        <View style={styles.content}>
          {totalPages === 1 ? (
            <View style={styles.page}>{renderPage(pages[0], 0)}</View>
          ) : (
            <FlatList
              ref={listRef}
              data={pages}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item, index }) => (
                <View style={[styles.page, { width: pageWidth }]}>{renderPage(item, index)}</View>
              )}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              snapToInterval={pageWidth}
              decelerationRate="fast"
              bounces={false}
              getItemLayout={(_, index) => ({
                length: pageWidth,
                offset: pageWidth * index,
                index,
              })}
            />
          )}
        </View>

        <View style={styles.divider} />

        {/* ── Pied de page ── */}
        <View style={styles.footer}>
          {isLastPage ? (
            <TouchableOpacity
              style={[
                styles.playBtn,
                { backgroundColor: theme.cta },
                theme.ctaBorder ? { borderWidth: 1, borderColor: theme.ctaBorder } : null,
              ]}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[styles.playBtnText, { color: theme.ctaText }]}>{t('btn_play')} ▶</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.swipeHint}>← {t('briefing_swipe_hint')} →</Text>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={goNext}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('briefing_next')}
              >
                <Text style={styles.nextBtnText}>→</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  title: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 16,
    borderRadius: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 22,
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
    gap: 8,
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
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  playBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontSize: 19,
    fontWeight: '800',
  },
  nextBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
