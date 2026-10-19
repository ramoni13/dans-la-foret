// ============================================================
// TREE CARD GALLERY — Modal galerie collection Herbier de la Forêt
// Navigation flèche gauche/droite, 1 carte grande à la fois.
// Seules les cartes débloquées sont affichées ici.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TREES_DATA } from '../../data/treesData';
import { getUnlockedCardCount, getCardProgress } from '../../utils/onfCards';
import { TreeCardView } from './TreeCardView';
import { useT } from '../../i18n';

// ── Props ─────────────────────────────────────────────────────────────────────
interface TreeCardGalleryProps {
  visible: boolean;
  onClose: () => void;
  onfSolvedCount: number;
  /** Si fourni, affiche directement cette carte à l'ouverture */
  initialCardId?: number;
}

// ── Composant ─────────────────────────────────────────────────────────────────
export function TreeCardGallery({
  visible,
  onClose,
  onfSolvedCount,
  initialCardId,
}: TreeCardGalleryProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const unlockedCount = getUnlockedCardCount(onfSolvedCount);
  const progress      = getCardProgress(onfSolvedCount);

  // Cartes débloquées uniquement
  const unlockedCards = TREES_DATA.slice(0, unlockedCount);
  const total         = unlockedCards.length;

  // Index courant
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialise l'index sur la bonne carte à l'ouverture
  useEffect(() => {
    if (!visible) return;
    if (initialCardId) {
      const idx = unlockedCards.findIndex(c => c.id === initialCardId);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      setCurrentIndex(0);
    }
  }, [visible, initialCardId, unlockedCount]);

  // Animation slide (décalage horizontal entre cartes)
  const slideAnim = useRef(new Animated.Value(0)).current;

  const navigateTo = useCallback((nextIndex: number, direction: 'left' | 'right') => {
    const outDir = direction === 'right' ? -screenW : screenW;
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: outDir * 0.3,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -outDir * 0.3,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    setCurrentIndex(nextIndex);
  }, [slideAnim, screenW]);

  const goLeft = useCallback(() => {
    if (currentIndex > 0) navigateTo(currentIndex - 1, 'left');
  }, [currentIndex, navigateTo]);

  const goRight = useCallback(() => {
    if (currentIndex < total - 1) navigateTo(currentIndex + 1, 'right');
  }, [currentIndex, total, navigateTo]);

  const currentCard = unlockedCards[currentIndex] ?? null;

  // Dimensions de la carte — on adapte à l'écran
  const cardMaxH = screenH * 0.62;
  const cardH    = Math.min(480, cardMaxH);
  const cardW    = Math.round(cardH * (300 / 480));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🌲 {t('gallery_title')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('gallery_subtitle_unlocked', { owned: String(unlockedCount), total: String(TREES_DATA.length) })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Progression avant prochaine carte ── */}
        {unlockedCount < TREES_DATA.length && (
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(progress.current / progress.total) * 100}%` as any },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {t('gallery_progress_text', { current: String(progress.current), total: String(progress.total) })}
            </Text>
          </View>
        )}

        {/* ── État vide ── */}
        {total === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>{t('gallery_empty_title')}</Text>
            <Text style={styles.emptyDesc}>{t('gallery_empty_desc')}</Text>
          </View>
        ) : (
          <>
            {/* ── Compteur ── */}
            <Text style={styles.cardCounter}>
              {currentIndex + 1} / {total}
            </Text>

            {/* ── Zone de navigation ── */}
            <View style={styles.navRow}>

              {/* Flèche gauche */}
              <TouchableOpacity
                style={[styles.arrowBtn, currentIndex === 0 && styles.arrowDisabled]}
                onPress={goLeft}
                disabled={currentIndex === 0}
                activeOpacity={0.7}
                hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              >
                <Text style={[styles.arrowText, currentIndex === 0 && styles.arrowTextDisabled]}>
                  ‹
                </Text>
              </TouchableOpacity>

              {/* Carte centrale animée */}
              <Animated.View
                style={[
                  styles.cardWrapper,
                  { width: cardW, height: cardH, transform: [{ translateX: slideAnim }] },
                ]}
              >
                {currentCard && (
                  <TreeCardView
                    key={currentCard.id}
                    tree={currentCard}
                    size="normal"
                    cardWidth={cardW}
                    cardHeight={cardH}
                  />
                )}
              </Animated.View>

              {/* Flèche droite */}
              <TouchableOpacity
                style={[styles.arrowBtn, currentIndex === total - 1 && styles.arrowDisabled]}
                onPress={goRight}
                disabled={currentIndex === total - 1}
                activeOpacity={0.7}
                hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              >
                <Text style={[styles.arrowText, currentIndex === total - 1 && styles.arrowTextDisabled]}>
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hint flip */}
            <Text style={styles.flipHint}>{t('gallery_flip_hint')}</Text>

            {/* Indicateurs de points (dots) */}
            {total <= 20 && (
              <View style={styles.dots}>
                {unlockedCards.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => navigateTo(i, i > currentIndex ? 'right' : 'left')}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Espace bas */}
        <View style={{ height: Math.max(insets.bottom, 16) }} />
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#F5F0E8',
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  headerLeft: { width: 36 },
  headerCenter: {
    flex:       1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize:   18,
    fontWeight: '800',
    color:      '#1A3C1A',
  },
  headerSubtitle: {
    fontSize:  13,
    color:     '#6D8B6D',
    marginTop: 2,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#555',
  },

  // Progression
  progressRow: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               6,
  },
  progressBarBg: {
    height:          8,
    backgroundColor: '#D8CCBA',
    borderRadius:    4,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          8,
    backgroundColor: '#2D6A2D',
    borderRadius:    4,
  },
  progressText: {
    fontSize: 11,
    color:    '#7A6A5A',
  },

  // Compteur
  cardCounter: {
    textAlign:  'center',
    fontSize:   13,
    color:      '#9E8E7E',
    marginTop:  10,
    marginBottom: 4,
  },

  // Navigation carte
  navRow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  arrowBtn: {
    width:           44,
    height:          80,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(45,106,45,0.12)',
    borderRadius:    22,
    marginHorizontal: 4,
  },
  arrowDisabled: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  arrowText: {
    fontSize:   42,
    lineHeight: 48,
    color:      '#2D6A2D',
    fontWeight: '300',
  },
  arrowTextDisabled: {
    color: '#BDBDBD',
  },
  cardWrapper: {
    // la carte gère sa propre taille via props
  },

  // Hint
  flipHint: {
    textAlign:  'center',
    fontSize:   12,
    color:      '#BDBDBD',
    marginTop:  10,
    marginBottom: 6,
  },

  // Dots
  dots: {
    flexDirection:  'row',
    justifyContent: 'center',
    flexWrap:       'wrap',
    gap:            6,
    paddingHorizontal: 20,
    marginBottom:   4,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#C8C0B0',
  },
  dotActive: {
    backgroundColor: '#2D6A2D',
    width:           10,
    height:          6,
    borderRadius:    3,
  },

  // État vide
  emptyState: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    gap:               12,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: {
    fontSize:   18,
    fontWeight: '800',
    color:      '#1A3C1A',
    textAlign:  'center',
  },
  emptyDesc: {
    fontSize:   14,
    color:      '#6D8B6D',
    textAlign:  'center',
    lineHeight: 20,
  },
});
