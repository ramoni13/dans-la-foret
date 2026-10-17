// ============================================================
// ONF LOBBY — Page intermédiaire avant de jouer ONF
// Route : /game/onf-lobby
//
// Affiche :
// - Stats (défis réussis, progression Herbier)
// - Aperçu de la prochaine carte à débloquer (verrouillée)
// - Bouton "Jouer" → /game/onf?size=3 ou size=4
// - Bouton "Voir mes cartes" → ouvre la galerie
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePlayerStore } from '../../src/store/playerStore';
import { ONF_4X4_UNLOCK_COUNT } from '../../src/constants/onf';
import { getUnlockedCardCount, getNextCard, getCardProgress } from '../../src/utils/onfCards';
import { TREES_DATA } from '../../src/data/treesData';
import { TreeCardView } from '../../src/components/ONF/TreeCardView';
import { TreeCardGallery } from '../../src/components/ONF/TreeCardGallery';

// ── Composant ─────────────────────────────────────────────────────────────────
export default function ONFLobbyScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const player  = usePlayerStore();
  const [galleryVisible, setGalleryVisible] = useState(false);

  const onfSolvedCount  = player.onfSolvedCount;
  const unlockedCount   = getUnlockedCardCount(onfSolvedCount);
  const nextCard        = getNextCard(onfSolvedCount);
  const progress        = getCardProgress(onfSolvedCount);
  const collectionFull  = unlockedCount >= TREES_DATA.length;

  // Taille de grille : même logique que index.tsx
  const gridSize = onfSolvedCount >= ONF_4X4_UNLOCK_COUNT ? 4 : 3;

  // ── ProgressBar animée ─────────────────────────────────────
  const barWidth = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));

  useEffect(() => {
    const ratio = collectionFull ? 1 : progress.current / progress.total;
    barWidth.value = withTiming(ratio, { duration: 600 });
  }, [progress.current, progress.total, collectionFull]);

  const handlePlay = () => {
    router.push(`/game/onf?size=${gridSize}`);
  };

  const defisRestants = progress.total - progress.current;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>🌲 Grille Forestière</Text>
            <Text style={styles.subtitle}>Mode ONF</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* ── Bloc stats ── */}
        <View style={styles.statsCard}>
          {/* Compteur de défis */}
          <Text style={styles.statsCount}>
            {onfSolvedCount === 0
              ? 'Aucun défi réussi'
              : onfSolvedCount === 1
                ? '1 défi réussi'
                : `${onfSolvedCount} défis réussis`}
          </Text>

          <View style={styles.separator} />

          {/* Herbier progression */}
          <Text style={styles.herbierTitle}>Herbier de la Forêt</Text>

          {/* Barre de progression */}
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, barStyle]} />
          </View>
          <Text style={styles.progressLabel}>
            {progress.current}/{progress.total}
          </Text>

          {/* Texte sous la barre */}
          {collectionFull ? (
            <Text style={styles.progressHelp}>Collection complète ! 🏆</Text>
          ) : (
            <Text style={styles.progressHelp}>
              Encore {defisRestants} défi{defisRestants > 1 ? 's' : ''} pour débloquer une carte 🍃
            </Text>
          )}
        </View>

        {/* ── Prochaine carte (verrouillée) ── */}
        {!collectionFull && nextCard && (
          <View style={styles.nextCardSection}>
            <Text style={styles.nextCardLabel}>Prochaine carte</Text>
            <View style={styles.nextCardWrapper}>
              <TreeCardView tree={nextCard} size="mini" locked />
            </View>
          </View>
        )}

        {/* ── Bouton Jouer ── */}
        <TouchableOpacity
          style={styles.playBtn}
          onPress={handlePlay}
          activeOpacity={0.85}
        >
          <Text style={styles.playBtnText}>Jouer</Text>
          <Text style={styles.playBtnSub}>Grille {gridSize}×{gridSize}</Text>
        </TouchableOpacity>

        {/* ── Bouton galerie ── */}
        {unlockedCount > 0 && (
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={() => setGalleryVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.galleryBtnText}>
              Voir toutes mes cartes ({unlockedCount})
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Galerie ── */}
      <TreeCardGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        onfSolvedCount={onfSolvedCount}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#F5F0E8',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    gap:               20,
  },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 16,
  },
  backBtn: {
    width: 70,
  },
  backText: {
    fontSize:   14,
    color:      '#2D6A2D',
    fontWeight: '600',
  },
  headerTitles: { alignItems: 'center' },
  title: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#1A3C1A',
  },
  subtitle: {
    fontSize: 13,
    color:    '#6D8B6D',
    marginTop: 2,
  },

  // Stats card
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    padding:         20,
    gap:             10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       3,
  },
  statsCount: {
    fontSize:   18,
    fontWeight: '800',
    color:      '#1A3C1A',
    textAlign:  'center',
  },
  separator: {
    height:          1,
    backgroundColor: '#E0E0E0',
  },
  herbierTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#1A3C1A',
    textAlign:  'center',
  },
  progressBarBg: {
    height:          12,
    backgroundColor: '#E0E0E0',
    borderRadius:    6,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          12,
    backgroundColor: '#2D6A2D',
    borderRadius:    6,
  },
  progressLabel: {
    fontSize:  12,
    color:     '#9E9E9E',
    textAlign: 'center',
  },
  progressHelp: {
    fontSize:  13,
    color:     '#6D8B6D',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Prochaine carte
  nextCardSection: {
    alignItems: 'center',
    gap:        8,
  },
  nextCardLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#6D8B6D',
  },
  nextCardWrapper: {
    width:  150,
    height: 240,
  },

  // Bouton jouer
  playBtn: {
    backgroundColor: '#2D6A2D',
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
    gap:             4,
    shadowColor:     '#1A3C1A',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       5,
  },
  playBtnText: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#FFFFFF',
  },
  playBtnSub: {
    fontSize:  12,
    color:     'rgba(255,255,255,0.7)',
  },

  // Bouton galerie
  galleryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  galleryBtnText: {
    fontSize:         14,
    color:            '#2D6A2D',
    fontWeight:       '600',
    textDecorationLine: 'underline',
  },
});
