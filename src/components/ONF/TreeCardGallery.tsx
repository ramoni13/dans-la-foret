// ============================================================
// TREE CARD GALLERY — l'Herbier de la Forêt (Progression v2, C6 / Lot 7)
//
// Deux onglets :
//   - « Ma collection » : les cartes possédées, une grande carte à la fois, flèches gauche / droite ;
//   - « Planter »       : les cartes des régions OUVERTES, en SILHOUETTE tant qu'elles ne sont pas
//                         plantées. Le joueur choisit une carte et la paie en graines
//                         (`30 + 5 × floor(nbCartesPossédées / 10)`) après confirmation dans
//                         `PlantCardModal`, qui révèle ensuite la carte (confettis, carte retournable).
//
// Source de vérité des cartes possédées : `playerStore.collectedTreeCardIds`.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../../store/playerStore';
import {
  ALL_TREE_CARDS,
  TOTAL_TREE_CARDS,
  getCardProgress,
  getOwnedCards,
} from '../../utils/onfCards';
import {
  HERBIER_REGIONS,
  checkPlant,
  getOpenRegions,
  getPlantCost,
  getPlantableCards,
  getRegionFeature,
  countUnseenCards,
  formatBadgeCount,
  getRegionProgress,
} from '../../constants/herbier';
import { isFeatureUnlocked, HerbierRegion } from '../../constants/progression';
import { isDemoAccount } from '../../constants/devAccess';
import { auth } from '../../services/firebase';
import { updateCollectedCards, updateSeeds } from '../../services/playerService';
import { awardEarnedTrophies } from '../../services/trophyService';
import { awardBadgesFirestore } from '../../services/badgeService';
import { TreeCard } from '../../data/treesData';
import { TreeCardView } from './TreeCardView';
import { PlantCardModal, PlantConfirmResult } from './PlantCardModal';
import { useT } from '../../i18n';

type Tab = 'collection' | 'plant';

interface TreeCardGalleryProps {
  visible: boolean;
  onClose: () => void;
  /** Si fourni, affiche directement cette carte (onglet collection) à l'ouverture */
  initialCardId?: number;
  /** Onglet affiché à l'ouverture (« planter » depuis l'entrée de l'accueil). */
  initialTab?: Tab;
}

export function TreeCardGallery({ visible, onClose, initialCardId, initialTab = 'collection' }: TreeCardGalleryProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const collectedIds = usePlayerStore(s => s.collectedTreeCardIds);
  const seeds = usePlayerStore(s => s.seeds);
  const levelsCompleted = usePlayerStore(s => s.levelsCompleted);
  const username = usePlayerStore(s => s.username);
  const onfSolvedCount = usePlayerStore(s => s.onfSolvedCount);
  const plantTreeCard = usePlayerStore(s => s.plantTreeCard);
  const seenIds = usePlayerStore(s => s.seenTreeCardIds);
  const markTreeCardsSeen = usePlayerStore(s => s.markTreeCardsSeen);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [region, setRegion] = useState<HerbierRegion>('france');
  const [message, setMessage] = useState<string | null>(null);

  // Régions ouvertes (France d'emblée ; compte démo : toutes)
  const openRegions = useMemo(
    () => getOpenRegions(
      r => isFeatureUnlocked(getRegionFeature(r)!, { levelsCompleted }),
      isDemoAccount(username),
    ),
    [levelsCompleted, username],
  );

  const owned = useMemo(() => getOwnedCards(collectedIds), [collectedIds]);
  const ownedCount = owned.length;
  const plantCost = getPlantCost(ownedCount);
  const plantable = useMemo(
    () => getPlantableCards(ALL_TREE_CARDS, collectedIds, [region]).filter(() => openRegions.includes(region)),
    [collectedIds, region, openRegions],
  );
  const onfProgress = getCardProgress(onfSolvedCount);

  // Badge rouge de « Ma collection » : cartes obtenues que le joueur n'a pas encore vues dans sa collection.
  const unseenCount = countUnseenCards(collectedIds, seenIds);

  // Dès que la collection est AFFICHÉE (galerie ouverte ET onglet « Ma collection » actif), les cartes sont
  // marquées « vues » : le badge disparaît. Une carte plantée pendant que la collection est affichée est vue aussitôt.
  // `tabSynced` : à l'ouverture, `tab` garde un instant sa valeur précédente avant d'être recalé sur `initialTab`
  // (effet d'ouverture ci-dessous, qui passe `tabSynced` à true dans le MÊME rendu). On n'agit qu'une fois l'onglet
  // réellement affiché : sinon ouvrir l'Herbier sur « Planter » (depuis l'accueil) effacerait le badge sans que le
  // joueur ait vu sa collection.
  const [tabSynced, setTabSynced] = useState(false);
  useEffect(() => {
    if (visible && tabSynced && tab === 'collection' && unseenCount > 0) markTreeCardsSeen();
  }, [visible, tabSynced, tab, unseenCount]);

  // ── Collection : index courant ──
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    if (!visible) { setTabSynced(false); return; }
    setTab(initialTab);
    setTabSynced(true);
    setMessage(null);
    if (initialCardId) {
      const idx = owned.findIndex(c => c.id === initialCardId);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      setCurrentIndex(0);
    }
  }, [visible, initialCardId, initialTab]);

  // Une région fermée n'est jamais sélectionnée
  useEffect(() => {
    if (!openRegions.includes(region)) setRegion('france');
  }, [openRegions]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const total = owned.length;
  const navigateTo = useCallback((nextIndex: number, direction: 'left' | 'right') => {
    const outDir = direction === 'right' ? -screenW : screenW;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: outDir * 0.3, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -outDir * 0.3, duration: 0, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    setCurrentIndex(nextIndex);
  }, [slideAnim, screenW]);
  const goLeft = useCallback(() => { if (currentIndex > 0) navigateTo(currentIndex - 1, 'left'); }, [currentIndex, navigateTo]);
  const goRight = useCallback(() => { if (currentIndex < total - 1) navigateTo(currentIndex + 1, 'right'); }, [currentIndex, total, navigateTo]);
  const currentCard = owned[currentIndex] ?? null;

  const cardMaxH = screenH * 0.55;
  const cardH = Math.min(480, cardMaxH);
  const cardW = Math.round(cardH * (300 / 480));

  // ── Planter ──
  // Un tap sur une silhouette ouvre la modale de confirmation ; la plantation n'a lieu qu'à la confirmation
  // (`handlePlant`), puis la même modale révèle la carte.
  const [pendingCard, setPendingCard] = useState<TreeCard | null>(null);
  useEffect(() => { if (!visible) setPendingCard(null); }, [visible]);

  const handlePlant = (card: TreeCard): PlantConfirmResult => {
    const result = plantTreeCard(card.id);
    if (result.ok) {
      // Synchronisation cloud (best-effort) : graines dépensées ET carte, ensemble. Le store local fait foi.
      const uid = auth.currentUser?.uid;
      if (uid && !auth.currentUser?.isAnonymous) {
        const s = usePlayerStore.getState();
        updateSeeds(uid, s.seeds).catch(() => {});
        updateCollectedCards(uid, s.collectedTreeCardIds).catch(() => {});
      }
      // Botaniste : le nombre de cartes vient de monter — tout trophée atteint est décerné (Lot 8)
      const newTrophies = awardEarnedTrophies();
      if (newTrophies.length > 0 && uid && !auth.currentUser?.isAnonymous) awardBadgesFirestore(uid, newTrophies).catch(() => {});
      setMessage(t('herbier_planted', { cost: String(result.cost) }));
      return { ok: true };
    }
    const key = result.reason === 'not_enough_seeds' ? 'herbier_err_seeds'
      : result.reason === 'region_locked' ? 'herbier_err_locked'
      : 'herbier_err_other';
    return { ok: false, message: t(key, { cost: String(result.cost) }) };
  };

  const canAfford = seeds >= plantCost;
  const regionFeatureChapter = (r: HerbierRegion) => (r === 'europe' ? 5 : r === 'monde' ? 6 : r === 'remarquables' ? 7 : 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🌲 {t('gallery_title')}</Text>
            <Text
              style={styles.headerSubtitle}
              accessibilityLiveRegion="polite"
            >
              {t('gallery_subtitle_unlocked', { owned: String(ownedCount), total: String(TOTAL_TREE_CARDS) })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('common_close')}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Onglets ── */}
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['collection', 'plant'] as Tab[]).map(k => (
            <TouchableOpacity
              key={k}
              style={[styles.tab, tab === k && styles.tabActive]}
              onPress={() => { setTab(k); setMessage(null); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              accessibilityLabel={k === 'collection'
                ? (unseenCount > 0 && tab !== 'collection'
                    ? t('herbier_tab_collection_a11y_new', { count: String(ownedCount), new: String(unseenCount) })
                    : t('herbier_tab_collection_a11y', { count: String(ownedCount) }))
                : undefined}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                {k === 'collection'
                  ? t('herbier_tab_collection_count', { count: String(ownedCount) })
                  : t('herbier_tab_plant')}
              </Text>
              {/* Badge rouge : nombre de cartes nouvelles ; disparaît quand on ouvre la collection */}
              {k === 'collection' && unseenCount > 0 && tab !== 'collection' && (
                <View style={styles.tabBadge} pointerEvents="none" accessible={false} importantForAccessibility="no">
                  <Text style={styles.tabBadgeText}>{formatBadgeCount(unseenCount)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'collection' ? (
          <>
            {/* Progression vers la prochaine carte gratuite du Forestier */}
            <View style={styles.progressRow}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(onfProgress.current / onfProgress.total) * 100}%` as any }]} />
              </View>
              <Text style={styles.progressText}>
                {t('gallery_progress_text', { current: String(onfProgress.current), total: String(onfProgress.total) })}
              </Text>
            </View>

            {total === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>{t('gallery_empty_title')}</Text>
                <Text style={styles.emptyDesc}>{t('herbier_empty_desc')}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setTab('plant')} accessibilityRole="button">
                  <Text style={styles.primaryBtnText}>{t('herbier_tab_plant')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardCounter}>{currentIndex + 1} / {total}</Text>
                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[styles.arrowBtn, currentIndex === 0 && styles.arrowDisabled]}
                    onPress={goLeft} disabled={currentIndex === 0} activeOpacity={0.7}
                    hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
                    accessibilityRole="button" accessibilityLabel={t('herbier_prev')}
                  >
                    <Text style={[styles.arrowText, currentIndex === 0 && styles.arrowTextDisabled]}>‹</Text>
                  </TouchableOpacity>

                  <Animated.View style={[{ width: cardW, height: cardH, transform: [{ translateX: slideAnim }] }]}>
                    {currentCard && (
                      <TreeCardView key={currentCard.id} tree={currentCard} size="normal" cardWidth={cardW} cardHeight={cardH} />
                    )}
                  </Animated.View>

                  <TouchableOpacity
                    style={[styles.arrowBtn, currentIndex === total - 1 && styles.arrowDisabled]}
                    onPress={goRight} disabled={currentIndex === total - 1} activeOpacity={0.7}
                    hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
                    accessibilityRole="button" accessibilityLabel={t('herbier_next')}
                  >
                    <Text style={[styles.arrowText, currentIndex === total - 1 && styles.arrowTextDisabled]}>›</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.flipHint}>{t('gallery_flip_hint')}</Text>
              </>
            )}
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.plantContent}>
            {/* Graines et coût */}
            <View
              style={styles.costBox}
              accessible
              accessibilityLabel={t('herbier_cost_a11y', { seeds: String(seeds), cost: String(plantCost) })}
            >
              <Text style={styles.costText}>🌱 {seeds}</Text>
              <Text style={[styles.costHint, !canAfford && styles.costHintLow]}>
                {t('herbier_cost', { cost: String(plantCost) })}
              </Text>
            </View>

            {/* Régions */}
            <View style={styles.regionRow}>
              {HERBIER_REGIONS.map(r => {
                const isOpen = openRegions.includes(r);
                const prog = getRegionProgress(ALL_TREE_CARDS, collectedIds, r);
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.regionChip, region === r && styles.regionChipActive, !isOpen && styles.regionChipLocked]}
                    onPress={() => { if (isOpen) { setRegion(r); setMessage(null); } }}
                    disabled={!isOpen}
                    accessibilityRole="button"
                    accessibilityState={{ selected: region === r, disabled: !isOpen }}
                    accessibilityLabel={isOpen
                      ? t('herbier_region_a11y', { region: t(`herbier_region_${r}`), owned: String(prog.owned), total: String(prog.total) })
                      : t('herbier_region_locked_a11y', { region: t(`herbier_region_${r}`), chapter: String(regionFeatureChapter(r)) })}
                  >
                    <Text style={[styles.regionChipText, region === r && styles.regionChipTextActive]}>
                      {isOpen ? '' : '🔒 '}{t(`herbier_region_${r}`)}
                    </Text>
                    <Text style={styles.regionChipCount}>
                      {isOpen ? `${prog.owned} / ${prog.total}` : t('herbier_region_locked', { chapter: String(regionFeatureChapter(r)) })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {message && (
              <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text>
            )}

            {/* Silhouettes à planter */}
            {plantable.length === 0 ? (
              <Text style={styles.regionDone}>{t('herbier_region_complete')}</Text>
            ) : (
              <View style={styles.silhouetteGrid}>
                {plantable.map(card => (
                  <TouchableOpacity
                    key={card.id}
                    style={[styles.silhouette, !canAfford && styles.silhouetteDisabled]}
                    onPress={() => { setMessage(null); setPendingCard(card); }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canAfford }}
                    accessibilityLabel={t('herbier_plant_a11y', { cost: String(plantCost) })}
                  >
                    {/* Silhouette : on ne révèle ni le nom ni l'image avant la plantation */}
                    <Text style={styles.silhouetteEmoji}>🌳</Text>
                    <Text style={styles.silhouetteMark}>?</Text>
                    <Text style={styles.silhouetteCost}>🌱 {plantCost}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        <View style={{ height: Math.max(insets.bottom, 16) }} />

        {/* Confirmation de la plantation, puis révélation de la carte (confettis, carte retournable, OK) */}
        <PlantCardModal
          card={pendingCard}
          cost={plantCost}
          seeds={seeds}
          onConfirm={handlePlant}
          onClose={() => setPendingCard(null)}
        />
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E0D8CC',
  },
  headerLeft: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A3C1A' },
  headerSubtitle: { fontSize: 13, color: '#6D8B6D', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: '#555' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center' },
  tabActive: { backgroundColor: '#2D6A2D' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#5A6B5A' },
  tabBadge: {
    position: 'absolute', top: -6, right: 6, minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E53935', borderWidth: 2, borderColor: '#F5F0E8',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF', lineHeight: 14 },
  tabTextActive: { color: '#fff' },

  progressRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  progressBarBg: { height: 8, backgroundColor: '#D8CCBA', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#2D6A2D', borderRadius: 4 },
  progressText: { fontSize: 11, color: '#7A6A5A' },

  cardCounter: { textAlign: 'center', fontSize: 13, color: '#9E8E7E', marginTop: 4, marginBottom: 4 },
  navRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  arrowBtn: { width: 44, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(45,106,45,0.12)', borderRadius: 22, marginHorizontal: 4 },
  arrowDisabled: { backgroundColor: 'rgba(0,0,0,0.05)' },
  arrowText: { fontSize: 42, lineHeight: 48, color: '#2D6A2D', fontWeight: '300' },
  arrowTextDisabled: { color: '#BDBDBD' },
  flipHint: { textAlign: 'center', fontSize: 12, color: '#9E9E9E', marginTop: 10, marginBottom: 6 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1A3C1A', textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: '#6D8B6D', textAlign: 'center', lineHeight: 20 },
  primaryBtn: { backgroundColor: '#2D6A2D', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  plantContent: { padding: 16, gap: 14 },
  costBox: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  costText: { fontSize: 24, fontWeight: '800', color: '#1A3C1A' },
  costHint: { fontSize: 13, color: '#5A6B5A' },
  costHintLow: { color: '#B23A2E', fontWeight: '700' },

  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  regionChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8CCBA', alignItems: 'center', minWidth: 120 },
  regionChipActive: { borderColor: '#2D6A2D', backgroundColor: '#E6F4E6' },
  regionChipLocked: { opacity: 0.55 },
  regionChipText: { fontSize: 13, fontWeight: '800', color: '#3A4B3A' },
  regionChipTextActive: { color: '#1A3C1A' },
  regionChipCount: { fontSize: 11, color: '#7A8B7A', marginTop: 2 },

  message: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#2D6A2D' },
  regionDone: { textAlign: 'center', fontSize: 14, color: '#6D8B6D', paddingVertical: 24 },

  silhouetteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  silhouette: {
    width: 92, height: 120, borderRadius: 14, backgroundColor: '#1A3A1A', borderWidth: 2, borderColor: '#C9A84C',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  silhouetteDisabled: { opacity: 0.5 },
  silhouetteEmoji: { fontSize: 38, opacity: 0.35 },
  silhouetteMark: { position: 'absolute', top: 30, fontSize: 28, fontWeight: '900', color: '#C9A84C' },
  silhouetteCost: { fontSize: 12, fontWeight: '800', color: '#F5EDD0', marginTop: 40 },
});
