// ============================================================
// ONF LOBBY — Page intermédiaire avant de jouer au Défi de la forêt
// Route : /game/onf-lobby
//
// Mise en page (de haut en bas) :
// - En-tête compact : retour, titre, « N grilles réussies » (plus de bloc de stats)
// - Parcours des 3 paliers (Sentier → Clairière → forêt profonde) + UNE barre « x / n grilles » du palier en cours
// - Herbier sur une ligne : miniature de la prochaine carte, progression avant la suivante, « Mes cartes (N) »
// - Pied de page FIXE, toujours visible sans défiler : « Jouer ».
// Le quota commun et ses options de recharge sont affichés sur l'accueil.
// Le palier joué est choisi par pickOnfChallenge selon les paliers ouverts.
// ============================================================

import React, { useEffect, useState } from 'react';
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
import { useFeatureAccess } from '../../src/hooks/useFeatureAccess';
import { getHighestOpenTier, ONF_TIER_ORDER, OnfTier } from '../../src/constants/onfTiers';
import { FEATURE_UNLOCK_CHAPTER } from '../../src/constants/progression';
import { getAllOnfChallenges } from '../../src/services/onfChallengeService';
import { getOwnedCardCount, getNextCard, getCardProgress } from '../../src/utils/onfCards';
import { getOpenRegions, getRegionFeature } from '../../src/constants/herbier';
import { isFeatureUnlocked } from '../../src/constants/progression';
import { isDemoAccount } from '../../src/constants/devAccess';
import { getDailyChallengesRemaining, isLimitsOfDay, todayLocalISO } from '../../src/constants/dailyLimits';
import { getAdViews } from '../../src/constants/adRewards';
import { TreeCardView } from '../../src/components/ONF/TreeCardView';
import { TreeCardGallery } from '../../src/components/ONF/TreeCardGallery';
import { useT } from '../../src/i18n';

/** Miniature de la prochaine carte de l'Herbier (même ratio 150 / 240 que la carte « mini »). */
const THUMB_W = 72;
const THUMB_H = 115;

// ── Composant ─────────────────────────────────────────────────────────────────
export default function ONFLobbyScreen() {
  const t       = useT();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const player  = usePlayerStore();
  const [galleryVisible, setGalleryVisible] = useState(false);

  // Herbier : la source de vérité est `collectedTreeCardIds` (plus onfSolvedCount, Progression v2 C6).
  const onfSolvedCount  = player.onfSolvedCount;
  const openRegions     = getOpenRegions(
    r => isFeatureUnlocked(getRegionFeature(r)!, { levelsCompleted: player.levelsCompleted }),
    isDemoAccount(player.username),
  );
  const unlockedCount   = getOwnedCardCount(player.collectedTreeCardIds);
  const nextCard        = getNextCard(player.collectedTreeCardIds, openRegions);
  const progress        = getCardProgress(onfSolvedCount);
  const collectionFull  = nextCard === null;

  // ── Paliers du Forestier (Progression v2, C4) ──────────────
  // Palier en cours = le plus élevé des paliers ouverts. Le parcours montre les 3 paliers : terminé / en cours /
  // à venir (verrouillé, avec le chapitre qui l'ouvre).
  const access = useFeatureAccess('demo');
  const openTiers = access.onfTiers;
  const currentTier: OnfTier | null = getHighestOpenTier(openTiers);
  const completedOnfIds = player.completedOnfChallengeIds;
  const tierStats = React.useMemo(() => {
    if (!currentTier) return null;
    const grids = getAllOnfChallenges().filter(c => c.tier === currentTier);
    const done = grids.filter(c => completedOnfIds.includes(c.id)).length;
    return { done, total: grids.length };
  }, [currentTier, completedOnfIds]);

  /** Un palier ouvert est « terminé » quand un palier plus élevé est ouvert (on joue dans le plus haut). */
  const tierState = (tier: OnfTier): 'done' | 'current' | 'locked' => {
    if (!openTiers.includes(tier)) return 'locked';
    return tier === currentTier ? 'current' : 'done';
  };
  const tierChapter = (tier: OnfTier): number =>
    FEATURE_UNLOCK_CHAPTER[(`onf_${tier}`) as 'onf_sentier' | 'onf_clairiere' | 'onf_profonde'];

  // ── Barres animées (palier en cours, Herbier) ──────────────
  const tierRatio = tierStats && tierStats.total > 0 ? tierStats.done / tierStats.total : 0;
  const tierBar = useSharedValue(0);
  const tierBarStyle = useAnimatedStyle(() => ({ width: `${tierBar.value * 100}%` as any }));
  useEffect(() => {
    tierBar.value = withTiming(tierRatio, { duration: 600 });
  }, [tierRatio]);

  const cardRatio = collectionFull ? 1 : progress.current / progress.total;
  const cardBar = useSharedValue(0);
  const cardBarStyle = useAnimatedStyle(() => ({ width: `${cardBar.value * 100}%` as any }));
  useEffect(() => {
    cardBar.value = withTiming(cardRatio, { duration: 600 });
  }, [cardRatio]);

  // ── Quota quotidien (Lot A) ─────────────────────────────────
  // Un compteur d'un autre jour est périmé : 0 grille jouée aujourd'hui.
  const challengeRecharges = isLimitsOfDay(player, todayLocalISO())
    ? getAdViews(player.adViews, 'onf_recharge')
    : 0;
  const canPlayChallenge = player.isPremium || isDemoAccount(player.username) ||
    getDailyChallengesRemaining({
      challengeCountToday: isLimitsOfDay(player, todayLocalISO()) ? player.challengeCountToday : 0,
      exempt: false,
      recharges: challengeRecharges,
    }) > 0;

  const handlePlay = () => {
    if (!canPlayChallenge) {
      router.replace('/(tabs)');
      return;
    }
    router.push('/game/onf');
  };

  const gridsLeftForCard = progress.total - progress.current;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── En-tête compact : retour, titre, grilles réussies ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>{t('onf_lobby_back')}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>🌲 {t('onf_lobby_title')}</Text>
            <Text style={styles.subtitle}>
              {onfSolvedCount === 0
                ? t('onf_lobby_solved_zero')
                : onfSolvedCount === 1
                  ? t('onf_lobby_solved_one')
                  : t('onf_lobby_solved_plural', { count: String(onfSolvedCount) })}
            </Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* ── Palier : parcours des 3 paliers + une seule barre de progression ── */}
        {currentTier && tierStats && (
          <View
            style={styles.tierCard}
            accessible
            accessibilityLabel={t('onf_tier_progress_a11y', {
              tier: t(`onf_tier_${currentTier}`),
              done: String(tierStats.done),
              total: String(tierStats.total),
            })}
          >
            <View style={styles.stepper}>
              {ONF_TIER_ORDER.map((tier, i) => {
                const state = tierState(tier);
                return (
                  <React.Fragment key={tier}>
                    {i > 0 && (
                      <View style={[styles.stepLine, state !== 'locked' && styles.stepLineOn]} />
                    )}
                    <View style={styles.step}>
                      <View
                        style={[
                          styles.stepDot,
                          state === 'done' && styles.stepDotDone,
                          state === 'current' && styles.stepDotCurrent,
                        ]}
                      >
                        <Text style={[styles.stepDotText, state === 'locked' && styles.stepDotTextLocked]}>
                          {state === 'done' ? '✓' : state === 'locked' ? '🔒' : String(i + 1)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.stepName, state === 'current' && styles.stepNameCurrent, state === 'locked' && styles.stepNameLocked]}
                        numberOfLines={2}
                      >
                        {t(`onf_tier_${tier}`)}
                      </Text>
                      {state === 'locked' && (
                        <Text style={styles.stepChapter}>
                          {t('onf_tier_chapter_short', { chapter: String(tierChapter(tier)) })}
                        </Text>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>

            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, tierBarStyle]} />
            </View>
            <Text style={styles.tierProgress}>
              {t('onf_tier_progress', { done: String(tierStats.done), total: String(tierStats.total) })}
            </Text>
          </View>
        )}

        {/* ── Herbier sur une ligne : prochaine carte, progression, accès à la collection ── */}
        <View style={styles.herbierCard}>
          {!collectionFull && nextCard ? (
            <View style={{ width: THUMB_W, height: THUMB_H }}>
              <TreeCardView tree={nextCard} cardWidth={THUMB_W} cardHeight={THUMB_H} locked />
            </View>
          ) : (
            <Text style={styles.herbierTrophy}>🏆</Text>
          )}
          <View style={styles.herbierBody}>
            <Text style={styles.herbierTitle}>{t('gallery_title')}</Text>
            <View style={styles.herbierBarBg}>
              <Animated.View style={[styles.herbierBarFill, cardBarStyle]} />
            </View>
            <Text style={styles.herbierHelp}>
              {collectionFull
                ? t('onf_lobby_complete')
                : gridsLeftForCard === 1
                  ? t('onf_lobby_card_remaining_one', { current: String(progress.current), total: String(progress.total) })
                  : t('onf_lobby_card_remaining', {
                      current: String(progress.current),
                      total: String(progress.total),
                      n: String(gridsLeftForCard),
                    })}
            </Text>
            {unlockedCount > 0 && (
              <TouchableOpacity
                style={styles.galleryBtn}
                onPress={() => setGalleryVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.galleryBtnText}>
                  🍃 {t('onf_lobby_my_cards', { count: String(unlockedCount) })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Pied de page FIXE : l'action principale reste visible sans défiler ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={handlePlay}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.playBtnText}>{t('onf_lobby_play')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Galerie ── */}
      <TreeCardGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
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
    paddingBottom:     16,
    gap:               16,
  },

  // En-tête
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 12,
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
    fontSize:  13,
    color:     '#6D8B6D',
    marginTop: 2,
  },

  // Palier : parcours + barre
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    padding:         16,
    gap:             10,
    borderWidth:     1.5,
    borderColor:     '#8BC34A',
  },
  stepper: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  step: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  stepLine: {
    height:          3,
    width:           24,
    marginTop:       15,
    marginHorizontal: -6,
    borderRadius:    2,
    backgroundColor: '#E0E0E0',
  },
  stepLineOn: { backgroundColor: '#8BC34A' },
  stepDot: {
    width:           34,
    height:          34,
    borderRadius:    17,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#EEEEEE',
    borderWidth:     2,
    borderColor:     '#E0E0E0',
  },
  stepDotDone:    { backgroundColor: '#8BC34A', borderColor: '#8BC34A' },
  stepDotCurrent: { backgroundColor: '#2D6A2D', borderColor: '#2D6A2D' },
  stepDotText:    { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  stepDotTextLocked: { fontSize: 14 },
  stepName: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#6D8B6D',
    textAlign:  'center',
  },
  stepNameCurrent: { color: '#1A3C1A', fontWeight: '800' },
  stepNameLocked:  { color: '#B0B0B0' },
  stepChapter: {
    fontSize:  11,
    color:     '#9E9E9E',
    textAlign: 'center',
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
  tierProgress: { fontSize: 14, fontWeight: '700', color: '#2D6A2D', textAlign: 'center' },

  // Herbier sur une ligne
  herbierCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    padding:         14,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       3,
  },
  herbierTrophy: { fontSize: 48, width: THUMB_W, textAlign: 'center' },
  herbierBody:   { flex: 1, gap: 6 },
  herbierTitle: {
    fontSize:   15,
    fontWeight: '800',
    color:      '#1A3C1A',
  },
  herbierBarBg: {
    height:          8,
    backgroundColor: '#E0E0E0',
    borderRadius:    4,
    overflow:        'hidden',
  },
  herbierBarFill: {
    height:          8,
    backgroundColor: '#2D6A2D',
    borderRadius:    4,
  },
  herbierHelp: {
    fontSize:   13,
    color:      '#6D8B6D',
    lineHeight: 18,
  },
  galleryBtn: {
    alignSelf:         'flex-start',
    minHeight:         44,
    justifyContent:    'center',
    paddingHorizontal: 14,
    marginTop:         2,
    borderRadius:      12,
    backgroundColor:   '#E8F5E9',
    borderWidth:       1.5,
    borderColor:       '#8BC34A',
  },
  galleryBtnText: {
    fontSize:   14,
    color:      '#2D6A2D',
    fontWeight: '700',
  },

  // Pied de page fixe
  footer: {
    paddingHorizontal: 20,
    paddingTop:        12,
    gap:               10,
    backgroundColor:   '#F5F0E8',
    borderTopWidth:    1,
    borderTopColor:    '#E0D9C8',
  },
  playBtn: {
    backgroundColor: '#2D6A2D',
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      'center',
    gap:             2,
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
});
