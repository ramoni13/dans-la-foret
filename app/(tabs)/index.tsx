// ============================================================
// ÉCRAN JOUER
// Fond illustré + Défi du Jour + Continuer + bouton vers les défis
// ============================================================

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { useFrameLayout, useMenuLayout } from '../../src/constants/frameLayout';
import { getLockMessageKey } from '../../src/constants/unlocks';
import { useFeatureAccess } from '../../src/hooks/useFeatureAccess';
import { useCeremonyPlayer } from '../../src/hooks/useCeremonyPlayer';
import { CeremonyModal } from '../../src/components/Game/CeremonyModal';
import { PineconeIcon, PineconeText } from '../../src/components/Game/PineconeIcon';
import { getRatingVariants } from '../../src/constants/pinecone';
import { hasNewBadge } from '../../src/constants/ceremonies';
import { PROGRESSION_V2 } from '../../src/constants/featureFlags';
import {
  CHAPTERS,
  computeLevelProgress,
  countTotalStars,
  getChapterForLevel,
  getChapterProgress,
  getChapterSeeds,
  getLevelStatus,
  getNextRecommended,
  getRecommendedChallengeId,
} from '../../src/constants/progression';
import { isAdminAccount, isDemoAccount } from '../../src/constants/devAccess';
import {
  FREE_DAILY_CHALLENGE_LIMIT,
  getDailyChallengesRemaining,
  getDailyChallengeQuota,
  isLimitsOfDay,
  todayLocalISO,
} from '../../src/constants/dailyLimits';
import { getAdViews, CHALLENGE_AD_RECHARGE_COUNT } from '../../src/constants/adRewards';
import { getOwnedCardCount } from '../../src/utils/onfCards';
import { HerbierEntry } from '../../src/components/ONF/HerbierEntry';
import { usePlayerStore } from '../../src/store/playerStore';
import { auth } from '../../src/services/firebase';
import { getDailyDateString, subscribeDailyLeaderboard, DailyResult } from '../../src/services/dailyChallengeService';
import { getPlayerLeague } from '../../src/constants/dailyLeagues';

import { formatTime } from '../../src/utils/boardUtils';
import { DifficultyLevel } from '../../src/core/models/Challenge';
import { WorldRecord } from '../../src/services/worldRecordService';
import { BgImage } from '../../src/components/UI/BgImage';
import { ForetCommuneWidget } from '../../src/components/ForetCommune/ForetCommuneWidget';
import { PremiumCard } from '../../src/components/Premium/PremiumCard';
import { useRewardedAd } from '../../src/hooks/useRewardedAd';
import { useT } from '../../src/i18n';
import { ParchmentBanner, TexturedButton } from '../../src/components/relooking/relookingPrimitives';
import { RelookingAssets } from '../../src/theme/relookingAssets';
import { useHomeFont } from '../../src/theme/homeTypography';
import { ForestColors } from '../../src/theme/forestTheme';


// ── Tous les défis (21 niveaux) ────────────────────────────────────────────────
import niveau1  from '../../src/data/challenges/niveau_1.json';
import niveau2  from '../../src/data/challenges/niveau_2.json';
import niveau3  from '../../src/data/challenges/niveau_3.json';
import niveau4  from '../../src/data/challenges/niveau_4.json';
import niveau5  from '../../src/data/challenges/niveau_5.json';
import niveau6  from '../../src/data/challenges/niveau_6.json';
import niveau7  from '../../src/data/challenges/niveau_7.json';
import niveau8  from '../../src/data/challenges/niveau_8.json';
import niveau9  from '../../src/data/challenges/niveau_9.json';
import niveau10 from '../../src/data/challenges/niveau_10.json';
import niveau11 from '../../src/data/challenges/niveau_11.json';
import niveau12 from '../../src/data/challenges/niveau_12.json';
import niveau13 from '../../src/data/challenges/niveau_13.json';
import niveau14 from '../../src/data/challenges/niveau_14.json';
import niveau15 from '../../src/data/challenges/niveau_15.json';
import niveau16 from '../../src/data/challenges/niveau_16.json';
import niveau17 from '../../src/data/challenges/niveau_17.json';
import niveau18 from '../../src/data/challenges/niveau_18.json';
import niveau19 from '../../src/data/challenges/niveau_19.json';
import niveau20 from '../../src/data/challenges/niveau_20.json';
import niveau21 from '../../src/data/challenges/niveau_21.json';

const LEVELS: Array<{
  id: DifficultyLevel;
  label: string;
  emoji: string;
  description: string;
  isPremium: boolean;
  color: string;
}> = [
  { id: 'niveau_1',  label: 'Niveau 1',  emoji: '🌱', description: '6 cases · 3 vides · Bucheron/Ours/Mouton',  isPremium: false, color: '#A5D6A7' },
  { id: 'niveau_2',  label: 'Niveau 2',  emoji: '🌿', description: '7 cases · 4 vides · Bucheron/Ours/Mouton',  isPremium: false, color: '#81C784' },
  { id: 'niveau_3',  label: 'Niveau 3',  emoji: '🌳', description: '8 cases · 4 vides · + Chien',               isPremium: false, color: '#66BB6A' },
  { id: 'niveau_4',  label: 'Niveau 4',  emoji: '🦊', description: '8 cases · 5 vides · Chien',                 isPremium: false, color: '#4CAF50' },
  { id: 'niveau_5',  label: 'Niveau 5',  emoji: '🏕️', description: '9 cases · 5 vides · + Loup',               isPremium: true,  color: '#43A047' },
  { id: 'niveau_6',  label: 'Niveau 6',  emoji: '🦌', description: '9 cases · 6 vides · Loup',                  isPremium: true,  color: '#388E3C' },
  { id: 'niveau_7',  label: 'Niveau 7',  emoji: '🌲', description: '10 cases · 6 vides · + Ruche',              isPremium: true,  color: '#2E7D32' },
  { id: 'niveau_8',  label: 'Niveau 8',  emoji: '🐺', description: '10 cases · 7 vides · Ruche',                isPremium: true,  color: '#1B5E20' },
  { id: 'niveau_9',  label: 'Niveau 9',  emoji: '🏔️', description: '11 cases · 7 vides · + Cerf/Biche',        isPremium: true,  color: '#33691E' },
  { id: 'niveau_10', label: 'Niveau 10', emoji: '🐾', description: '11 cases · 7 vides · Cerf/Biche',           isPremium: true,  color: '#558B2F' },
  { id: 'niveau_11', label: 'Niveau 11', emoji: '🏹', description: '11 cases · 7 vides · + Bûches',             isPremium: true,  color: '#827717' },
  { id: 'niveau_12', label: 'Niveau 12', emoji: '🪵', description: '12 cases · 7 vides · + Chalet',             isPremium: true,  color: '#6D4C41' },
  { id: 'niveau_13', label: 'Niveau 13', emoji: '🏠', description: '12 cases · 7 vides · Chalet',               isPremium: true,  color: '#4E342E' },
  { id: 'niveau_14', label: 'Niveau 14', emoji: '⚡',  description: '12 cases · 8 vides · Toutes tensions',     isPremium: true,  color: '#E65100' },
  { id: 'niveau_15', label: 'Niveau 15', emoji: '💀', description: '12 cases · 8 vides · Sans bonus',           isPremium: true,  color: '#3E2723' },
  { id: 'niveau_16', label: 'Niveau 16', emoji: '🌿', description: '13 cases · 8 vides · Coeur de la Forêt',   isPremium: true,  color: '#1A237E' },
  { id: 'niveau_17', label: 'Niveau 17', emoji: '🍄', description: '13 cases · 8 vides · + Champignon',        isPremium: true,  color: '#4A148C' },
  { id: 'niveau_18', label: 'Niveau 18', emoji: '☠️', description: '13 cases · 8 vides · Sans bonus · Max',   isPremium: true,  color: '#212121' },
  { id: 'niveau_19', label: 'Niveau 19', emoji: '🌲', description: '14 cases · 9 vides · + Arbre',             isPremium: true,  color: '#1B5E20' },
  { id: 'niveau_20', label: 'Niveau 20', emoji: '🌳', description: '14 cases · 8 vides · Apothéose',           isPremium: true,  color: '#33691E' },
  { id: 'niveau_21', label: 'Niveau 21', emoji: '🎆', description: '14 cases · 8 vides · Sans bonus · Feu Artifice !', isPremium: true,  color: '#0D0D0D' },
];

const ALL_CHALLENGES_BY_LEVEL: Record<string, any[]> = {
  niveau_1:  niveau1.challenges,
  niveau_2:  niveau2.challenges,
  niveau_3:  niveau3.challenges,
  niveau_4:  niveau4.challenges,
  niveau_5:  niveau5.challenges,
  niveau_6:  niveau6.challenges,
  niveau_7:  niveau7.challenges,
  niveau_8:  niveau8.challenges,
  niveau_9:  niveau9.challenges,
  niveau_10: niveau10.challenges,
  niveau_11: niveau11.challenges,
  niveau_12: niveau12.challenges,
  niveau_13: niveau13.challenges,
  niveau_14: niveau14.challenges,
  niveau_15: niveau15.challenges,
  niveau_16: niveau16.challenges,
  niveau_17: niveau17.challenges,
  niveau_18: niveau18.challenges,
  niveau_19: niveau19.challenges,
  niveau_20: niveau20.challenges,
  niveau_21: niveau21.challenges,
};

const ALL_CHALLENGES_FLAT = LEVELS.flatMap(l => ALL_CHALLENGES_BY_LEVEL[l.id] ?? []);

// ── Assets ─────────────────────────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════════════════════
// Sous-écran : navigateur de niveaux (carrousel + liste de défis)
// ══════════════════════════════════════════════════════════════════════════════
export function LevelsScreen({
  router,
  worldRecords,
  onOpenChallenge,
}: {
  router: ReturnType<typeof useRouter>;
  worldRecords: Map<string, WorldRecord>;
  onOpenChallenge?: () => void;
}) {
  const t = useT();
  const { frameBottom, contentTop } = useMenuLayout();
  const player  = usePlayerStore();
  const initialLevelIndex = Math.min(Math.max(0, player.currentLevel - 1), LEVELS.length - 1);
  const [levelIndex, setLevelIndex] = useState(initialLevelIndex);

  const selectedLevelDef = LEVELS[levelIndex];
  const selectedLevel    = selectedLevelDef.id;
  const challenges       = ALL_CHALLENGES_BY_LEVEL[selectedLevel] ?? [];
  const completedCount   = challenges.filter((c: any) =>
    player.completedChallenges.includes(c.id)
  ).length;
  const progressPct = challenges.length > 0
    ? Math.round((completedCount / challenges.length) * 100)
    : 0;

  const isDemoUser = isDemoAccount(player.username);

  // Progression v2 : le niveau N+1 s'ouvre quand étoiles(N) >= seuil(N) ; les 10 défis d'un niveau
  // ouvert sont accessibles (D13). Sinon : ancien comportement (10 défis complétés, défis séquentiels).
  const progress = useMemo(() => computeLevelProgress(player.challengeStars), [player.challengeStars]);
  const totalStars = useMemo(() => countTotalStars(player.challengeStars), [player.challengeStars]);

  const isLevelUnlocked = (idx: number): boolean => {
    if (isDemoUser) return true;
    if (idx === 0) return true;
    if (PROGRESSION_V2) return getLevelStatus(idx + 1, player.challengeStars, progress).isOpen;
    const prev = LEVELS[idx - 1];
    return (ALL_CHALLENGES_BY_LEVEL[prev.id] ?? []).every(
      (c: any) => player.completedChallenges.includes(c.id)
    );
  };

  const isChallengeUnlocked = (challengeIdx: number): boolean => {
    if (isDemoUser) return true;
    if (PROGRESSION_V2) return true; // D13 : niveau ouvert = 10 défis accessibles
    if (challengeIdx === 0) return true;
    return player.completedChallenges.includes(challenges[challengeIdx - 1].id);
  };

  const levelStatus = getLevelStatus(levelIndex + 1, player.challengeStars, progress);
  const recommendedId = PROGRESSION_V2 ? getRecommendedChallengeId(levelIndex + 1, player.challengeStars) : null;

  const currentUnlocked = isLevelUnlocked(levelIndex);
  const canGoPrev = levelIndex > 0;
  const canGoNext = levelIndex < LEVELS.length - 1;

  // Progression v2 : regroupement par chapitre (C3). Le chapitre du niveau affiché et son avancement.
  const chapter = PROGRESSION_V2 ? getChapterForLevel(levelIndex + 1) : null;
  const chapterProg = chapter ? getChapterProgress(chapter.id, player.challengeStars, progress) : null;
  const chapterSeeds = chapter ? getChapterSeeds(chapter) : 0;

  return (
    <View style={StyleSheet.absoluteFill}>
      <BgImage />

      {/* Header titre */}
      <View style={[styles.levelsHeader, { paddingTop: contentTop }]}>
        <Text style={styles.levelsHeaderTitle}>{t('index_all_challenges')}</Text>
        {PROGRESSION_V2 && (
          <PineconeText
            style={styles.levelsHeaderStars}
            liveRegion
            text={t('levels_total_stars', { count: String(totalStars), max: String(LEVELS.length * 30) })}
          />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.levelsContainer, { paddingBottom: frameBottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Bande des chapitres (Progression v2) : un appui saute au 1er niveau du chapitre */}
        {PROGRESSION_V2 && (
          <View style={styles.chapterStrip} accessibilityRole="tablist">
            {CHAPTERS.map(c => {
              const cp = getChapterProgress(c.id, player.challengeStars, progress);
              const active = chapter?.id === c.id;
              const locked = cp.status === 'locked' && !isDemoUser;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.chapterChip,
                    active && styles.chapterChipActive,
                    cp.status === 'completed' && styles.chapterChipDone,
                    locked && styles.chapterChipLocked,
                  ]}
                  onPress={() => setLevelIndex(c.levels[0] - 1)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active, disabled: false }}
                  accessibilityLabel={`${t('levels_chapter_header', { n: String(c.id), name: t(c.nameKey) })}, ${t(
                    cp.status === 'completed' ? 'rank_chapter_done' : cp.status === 'current' ? 'rank_chapter_current' : 'rank_chapter_locked',
                  )}`}
                >
                  <Text style={styles.chapterChipEmoji}>{locked ? '🔒' : c.emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* En-tête du chapitre du niveau affiché */}
        {chapter && chapterProg && (
          <View style={styles.chapterHeader}>
            <Text style={styles.chapterTitle}>
              {chapter.emoji} {t('levels_chapter_header', { n: String(chapter.id), name: t(chapter.nameKey) })}
            </Text>
            <Text style={styles.chapterSub}>
              {chapterProg.status === 'completed'
                ? `✓ ${t('levels_chapter_done')}`
                : chapterProg.status === 'locked' && !isDemoUser
                  ? t('levels_chapter_locked')
                  : t('levels_chapter_progress', {
                      done: String(chapterProg.levelsDone),
                      total: String(chapterProg.levelsTotal),
                      stars: String(chapterProg.stars),
                    })}
              {chapterSeeds > 0 && chapterProg.status !== 'completed'
                ? `  ·  ${t('levels_chapter_reward_seeds', { count: String(chapterSeeds) })}`
                : ''}
            </Text>
          </View>
        )}

        {/* Navigateur de niveau ‹/› */}
        <View style={styles.levelNavigator}>
          <TouchableOpacity
            style={[styles.arrowBtn, !canGoPrev && styles.arrowBtnDisabled]}
            onPress={() => canGoPrev && setLevelIndex(levelIndex - 1)}
            activeOpacity={canGoPrev ? 0.7 : 1}
            disabled={!canGoPrev}
          >
            <Text style={[styles.arrowText, !canGoPrev && styles.arrowTextDisabled]}>‹</Text>
          </TouchableOpacity>

          <View style={[
            styles.levelCard,
            { borderColor: currentUnlocked ? selectedLevelDef.color : 'rgba(255,255,255,0.2)' },
          ]}>
            <View style={[
              styles.levelCardBg,
              { backgroundColor: currentUnlocked ? selectedLevelDef.color + '22' : 'rgba(0,0,0,0.2)' },
            ]} />
            <Text style={styles.levelCardEmoji}>
              {currentUnlocked ? selectedLevelDef.emoji : '🔒'}
            </Text>
            <Text style={[
              styles.levelCardLabel,
              { color: currentUnlocked ? Colors.ui.seed : 'rgba(255,255,255,0.4)' },
            ]}>
              {t('level_prefix') + ' ' + selectedLevelDef.id.replace('niveau_', '')}
            </Text>
            <Text style={styles.levelCardDesc}>{selectedLevelDef.description}</Text>

            {PROGRESSION_V2 ? (
              <View
                style={styles.starGaugeBlock}
                accessible
                accessibilityLabel={t('levels_stars_gauge_a11y', {
                  current: String(levelStatus.starsShown),
                  threshold: String(levelStatus.threshold),
                  level: String(levelIndex + 1),
                })}
              >
                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <View style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.round(levelStatus.ratio * 100)}%`,
                        backgroundColor: levelStatus.isCompleted ? '#FFC107' : (currentUnlocked ? selectedLevelDef.color : Colors.ui.border),
                      },
                    ]} />
                  </View>
                  <PineconeText
                    style={[styles.progressLabel, styles.starGaugeLabel]}
                    text={t('levels_stars_gauge', { current: String(levelStatus.starsShown), threshold: String(levelStatus.threshold) })}
                  />
                </View>
                {currentUnlocked && (
                  <PineconeText
                    style={styles.starGaugeHint}
                    text={recommendedId === null
                      ? `🌟 ${t('levels_perfect_level')}`
                      : levelStatus.isCompleted
                        ? `✓ ${t('levels_level_completed')}`
                        : t('levels_stars_missing', { count: String(levelStatus.starsMissing) })}
                  />
                )}
              </View>
            ) : (
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { width: `${progressPct}%`, backgroundColor: currentUnlocked ? selectedLevelDef.color : Colors.ui.border },
                  ]} />
                </View>
                <Text style={styles.progressLabel}>{completedCount}/{challenges.length}</Text>
              </View>
            )}

            <View style={styles.dotsRow}>
              {LEVELS.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setLevelIndex(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <View style={[
                    styles.dot,
                    i === levelIndex
                      ? [styles.dotActive, { backgroundColor: selectedLevelDef.color }]
                      : { backgroundColor: isLevelUnlocked(i) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)' },
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.arrowBtn, !canGoNext && styles.arrowBtnDisabled]}
            onPress={() => canGoNext && setLevelIndex(levelIndex + 1)}
            activeOpacity={canGoNext ? 0.7 : 1}
            disabled={!canGoNext}
          >
            <Text style={[styles.arrowText, !canGoNext && styles.arrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des défis ou niveau verrouillé */}
        {!currentUnlocked ? (
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedEmoji}>🔒</Text>
            <Text style={styles.lockedTitle}>{t('index_level_locked_title')}</Text>
            <Text style={styles.lockedSubtitle}>
              {PROGRESSION_V2 && LEVELS[levelIndex - 1]
                ? t('levels_level_locked_stars', {
                    threshold: String(getLevelStatus(levelIndex, player.challengeStars, progress).threshold),
                    level: t('level_prefix') + ' ' + LEVELS[levelIndex - 1].id.replace('niveau_', ''),
                  })
                : t('index_level_locked_sub', {
                    level: LEVELS[levelIndex - 1]
                      ? t('level_prefix') + ' ' + LEVELS[levelIndex - 1].id.replace('niveau_', '')
                      : t('index_prev_level'),
                  })}
            </Text>
          </View>
        ) : (
          <View style={styles.challengeList}>
            {challenges.map((challenge: any, idx: number) => {
              const isCompleted = player.completedChallenges.includes(challenge.id);
              const unlocked    = isChallengeUnlocked(idx);
              const bestTime    = player.stats.bestTimes[challenge.id];
              const wr          = worldRecords.get(challenge.id);
              // Progression v2 : meilleure note du défi (0 = jamais gagné) et défi conseillé
              const stars: number = PROGRESSION_V2 ? (player.challengeStars[challenge.id] ?? 0) : 0;
              const isRecommended = PROGRESSION_V2 && challenge.id === recommendedId;
              return (
                <TouchableOpacity
                  key={challenge.id}
                  style={[
                    styles.challengeCard,
                    isCompleted && styles.challengeCardDone,
                    !unlocked && styles.challengeCardLocked,
                    isRecommended && styles.challengeCardRecommended,
                  ]}
                  accessibilityLabel={PROGRESSION_V2 && unlocked
                    ? [
                        t('index_challenge_label', { number: String(challenge.challengeNumber) }),
                        stars > 0 ? t('levels_challenge_stars_a11y', { count: String(stars) }) : t('levels_challenge_never_won'),
                        isRecommended ? t('levels_recommended_badge') : '',
                      ].filter(Boolean).join(', ')
                    : undefined}
                  onPress={() => {
                    if (unlocked) {
                      onOpenChallenge?.();
                      router.push(`/game/${challenge.id}?returnTo=levels`);
                    }
                  }}
                  activeOpacity={unlocked ? 0.8 : 1}
                >
                  <View style={[
                    styles.challengeAccent,
                    { backgroundColor: unlocked ? selectedLevelDef.color : 'rgba(255,255,255,0.1)' },
                  ]} />
                  <View style={styles.challengeLeft}>
                    <Text style={styles.challengeNumber}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.challengeCenter}>
                    <View style={styles.challengeTitleRow}>
                      <Text style={[styles.challengeTitle, !unlocked && styles.challengeTitleLocked]}>
                        {unlocked ? t('index_challenge_label', { number: String(challenge.challengeNumber) }) : t('index_challenge_locked')}
                      </Text>
                      {isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>{t('levels_recommended_badge')}</Text>
                        </View>
                      )}
                    </View>
                    {unlocked && (
                      <View style={styles.challengeTimes}>
                        {bestTime
                          ? <Text style={styles.challengeBestTime}>⏱ {formatTime(bestTime)}</Text>
                          : <Text style={styles.challengeNew}>{t('index_challenge_new')}</Text>
                        }
                        {wr && (
                          <Text style={styles.challengeWr} numberOfLines={1}>
                            🌍 {formatTime(wr.timeMs)} · {wr.username}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  {PROGRESSION_V2 && unlocked ? (
                    // Trois emplacements : bois (obtenue), vide (à gagner), trois dorées si le défi est à 3
                    <View style={styles.challengeStars} accessible={false}>
                      {getRatingVariants(stars).map((variant, n) => (
                        <PineconeIcon key={n} size={24} variant={variant} opacity={variant === 'empty' ? 0.75 : 1} />
                      ))}
                    </View>
                  ) : isCompleted
                    ? <Text style={styles.checkmark}>✓</Text>
                    : unlocked
                      ? <Text style={styles.challengeArrow}>→</Text>
                      : <Text style={styles.challengeArrow}>🔒</Text>
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Bottom-sheet : choix Défi Solo
// ══════════════════════════════════════════════════════════════════════════════
function SoloModal({
  visible,
  onClose,
  onPlay,
  onSeeAll,
  nextChallenge,
  totalCompleted,
  totalChallenges,
  allCompleted,
}: {
  visible: boolean;
  onClose: () => void;
  onPlay: () => void;
  onSeeAll: () => void;
  nextChallenge: { challenge: any; level: typeof LEVELS[0] } | null;
  totalCompleted: number;
  totalChallenges: number;
  allCompleted: boolean;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const progress = totalChallenges > 0 ? totalCompleted / totalChallenges : 0;

  // Libellé du bouton "Jouer"
  let playLabel = t('index_solo_start');
  let playSublabel = '';
  if (allCompleted) {
    playLabel   = t('index_solo_replay');
    playSublabel = t('index_solo_all_done', { completed: String(totalCompleted), total: String(totalChallenges) });
  } else if (nextChallenge) {
    const levelNum = nextChallenge.level.id.replace('niveau_', '');
    playLabel    = t('index_solo_play_label');
    playSublabel = t('index_solo_play_sublabel', { emoji: nextChallenge.level.emoji, level: t('level_prefix') + ' ' + levelNum, current: String(nextChallenge.challenge.challengeNumber) });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {/* Overlay — tap pour fermer */}
      <TouchableOpacity
        style={soloStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Carte bottom-sheet — stoppe la propagation */}
        <TouchableOpacity
          style={[soloStyles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 4 }]}
          activeOpacity={1}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={soloStyles.handle} />

          {/* Bouton fermer */}
          <TouchableOpacity
            style={soloStyles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={soloStyles.closeBtnText}>×</Text>
          </TouchableOpacity>

          {/* Titre */}
          <Text style={soloStyles.title}>{t('index_solo_title')}</Text>

          {/* Progression */}
          <Text style={soloStyles.progressText}>
            {t('index_solo_progress', { completed: String(totalCompleted), total: String(totalChallenges) })}
          </Text>
          <View style={soloStyles.barBg}>
            <View style={[soloStyles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          {/* Séparateur */}
          <View style={soloStyles.separator} />

          {/* Bouton principal — Jouer */}
          <TouchableOpacity
            style={soloStyles.btnPlay}
            onPress={onPlay}
            activeOpacity={0.85}
          >
            <Text style={soloStyles.btnPlayLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{playLabel}</Text>
            {playSublabel ? (
              <Text style={soloStyles.btnPlaySublabel}>{playSublabel}</Text>
            ) : null}
          </TouchableOpacity>

          {/* Bouton secondaire — Voir tous les niveaux */}
          <TouchableOpacity
            style={soloStyles.btnSeeAll}
            onPress={onSeeAll}
            activeOpacity={0.8}
          >
            <Text style={soloStyles.btnSeeAllText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('index_solo_see_all')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const soloStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A3A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(139,195,74,0.2)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 4,
  },
  progressText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginBottom: 6,
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#4A7C59',
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    marginVertical: 20,
  },
  btnPlay: {
    backgroundColor: '#4A7C59',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnPlayLabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  btnPlaySublabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingHorizontal: 12,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  btnSeeAll: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSeeAllText: {
    // Pleine largeur + centré : le texte est mesuré sur la largeur réelle du bouton (et non sur sa largeur"intrinsèque",
    // fausse avec l'emoji sur Android, ce qui coupait le dernier mot)
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingHorizontal: 12,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// Écran principal
// ══════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const t = useT();
  const fontFamily = useHomeFont();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { frameBottom, innerTop } = useFrameLayout();
  const player = usePlayerStore();
  const challengeRechargeAd = useRewardedAd('onf_recharge');
  const { authReady, isAuthenticated } = player;
  // Déblocages des modes (Progression v2, C3) : dev = Ramoni/Cedric/planete, demo = planete.
  const devAccess  = useFeatureAccess('dev');
  const demoAccess = useFeatureAccess('demo');

  const [showPremium, setShowPremium]     = useState(false);
  const [showProgressHelp, setShowProgressHelp] = useState(false);
  const isFreePlayer = !player.isPremium && !isDemoAccount(player.username);
  const challengeCountToday = isLimitsOfDay(player, todayLocalISO()) ? player.challengeCountToday : 0;
  const challengeRecharges = isLimitsOfDay(player, todayLocalISO())
    ? getAdViews(player.adViews, 'onf_recharge')
    : 0;
  const challengeQuota = getDailyChallengeQuota(challengeRecharges);
  const challengeRemaining = getDailyChallengesRemaining({
    challengeCountToday,
    exempt: !isFreePlayer,
    recharges: challengeRecharges,
  });

  // Cérémonies de fin de chapitre (Progression v2, C7) : jouées au retour sur l'accueil, jamais
  // pendant une partie. Pas pendant l'écran des niveaux, la modale solo ou la carte premium.
  const ceremony = useCeremonyPlayer(
    authReady && isAuthenticated && !showPremium,
  );

  // ── Prochain défi non complété ─────────────────────────────────────────────
  // PROGRESSION_V2 : « prochain conseillé » (premier défi jamais gagné du niveau jouable le plus
  // haut, sinon premier défi sans ⭐⭐⭐). Sinon : premier défi non complété dans l'ordre des niveaux.
  const nextChallenge = useMemo(() => {
    if (PROGRESSION_V2) {
      const rec = getNextRecommended(player.challengeStars);
      if (rec) {
        const level = LEVELS[rec.level - 1];
        const challenge = (ALL_CHALLENGES_BY_LEVEL[level.id] ?? []).find((c: any) => c.id === rec.challengeId);
        if (challenge) return { challenge, level };
      }
    } else {
      for (const level of LEVELS) {
        const list = ALL_CHALLENGES_BY_LEVEL[level.id] ?? [];
        const next = list.find((c: any) => !player.completedChallenges.includes(c.id));
        if (next) return { challenge: next, level };
      }
    }
    const first = (ALL_CHALLENGES_BY_LEVEL[LEVELS[0].id] ?? [])[0];
    return first ? { challenge: first, level: LEVELS[0] } : null;
  }, [player.completedChallenges, player.challengeStars]);

  const totalCompleted  = player.completedChallenges.length;
  const totalChallenges = ALL_CHALLENGES_FLAT.length;
  // PROGRESSION_V2 : « tout terminé » = les 210 défis à ⭐⭐⭐ (plus aucun défi conseillé).
  const allCompleted    = PROGRESSION_V2
    ? getNextRecommended(player.challengeStars) === null
    : totalCompleted >= totalChallenges;
  const soloProgress = useMemo(() => computeLevelProgress(player.challengeStars), [player.challengeStars]);
  const soloLevelStatus = getLevelStatus(soloProgress.currentLevel, player.challengeStars, soloProgress);
  const recommendedLevel = nextChallenge ? Number(nextChallenge.level.id.replace('niveau_', '')) : null;
  const recommendedChapter = recommendedLevel !== null ? getChapterForLevel(recommendedLevel) : null;

  // ── Défi du Jour ───────────────────────────────────────────────────────────
  const todayStr      = useMemo(() => getDailyDateString(new Date()), []);
  const dailyStatus   = player.dailyChallengeStatus;
  const dailyLastDate = player.lastDailyChallengeDate;
  const isDailyToday  = dailyLastDate === todayStr;
  const dailyStreak   = player.dailyChallengeStreak;

  // Record du jour DE MA LIGUE : top 1 du classement de la ligue du joueur (Pousse / Grand Chêne).
  // Avant l'ouverture du Journalier le joueur n'a pas de ligue : on lit la Pousse, la plus accessible.
  const dailyLeague = getPlayerLeague(devAccess.dailyLeagues) ?? 'pousse';
  const [dailyLeader, setDailyLeader] = useState<DailyResult | null>(null);
  useEffect(() => {
    const unsub = subscribeDailyLeaderboard(todayStr, dailyLeague, 1, (results) => {
      setDailyLeader(results.length > 0 ? results[0] : null);
    });
    return () => unsub();
  }, [todayStr, dailyLeague]);

  // ── Animations "émergence de brume" ─────────────────────────────────────
  // Chaque carte apparaît progressivement (opacity 0→1, scale 0.92→1)
  // comme si elle émergeait doucement de la brume de la forêt
  const scaleSolo   = useRef(new Animated.Value(0.92)).current;
  const scaleDaily  = useRef(new Animated.Value(0.92)).current;
  const scaleOnf    = useRef(new Animated.Value(0.92)).current;
  const scaleWidget = useRef(new Animated.Value(0.92)).current;
  const opaSolo     = useRef(new Animated.Value(0)).current;
  const opaDaily    = useRef(new Animated.Value(0)).current;
  const opaOnf      = useRef(new Animated.Value(0)).current;
  const opaWidget   = useRef(new Animated.Value(0)).current;

  // Redéclenché à chaque focus sur l'onglet (retour depuis un autre menu)
  useFocusEffect(
    useCallback(() => {
      if (!authReady || !isAuthenticated) return;
      usePlayerStore.getState().rolloverDailyLimits();

      // Remise aux valeurs initiales avant chaque lancement
      scaleSolo.setValue(0.92);
      scaleDaily.setValue(0.92);
      scaleOnf.setValue(0.92);
      scaleWidget.setValue(0.92);
      opaSolo.setValue(0);
      opaDaily.setValue(0);
      opaOnf.setValue(0);
      opaWidget.setValue(0);

      // Émergence douce : scale 0.92→1 + opacity 0→1 avec décalage entre chaque carte
      const makeAppear = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            delay,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            delay,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);

      Animated.parallel([
        makeAppear(scaleSolo,   opaSolo,   0),
        makeAppear(scaleDaily,  opaDaily,  180),
        makeAppear(scaleOnf,    opaOnf,    360),
        makeAppear(scaleWidget, opaWidget, 540),
      ]).start();
    }, [authReady, isAuthenticated])
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isDailyToday && dailyStatus) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isDailyToday, dailyStatus]);

  const dailyUnlocked = devAccess.isOpen('daily_pousse');
  const dailyFinished = isDailyToday && !!dailyStatus;
  const dailyLock = getLockMessageKey(devAccess.lockHint('daily_pousse'));
  const dailyTime = player.dailyChallengeTimeMs;
  const dailyMyRecord = dailyLeader != null && (player.userId ?? auth.currentUser?.uid) === dailyLeader.userId;
  const dailySublabel = !dailyUnlocked
    ? t(dailyLock.key, dailyLock.vars)
    : !dailyFinished
      ? dailyLeader ? '🏆 ' + formatTime(dailyLeader.timeMs) + ' · ' + dailyLeader.username : t('index_daily_discover')
      : dailyStatus !== 'success'
        ? t('index_daily_failed')
        : dailyTime != null && dailyMyRecord
          ? t('index_daily_done_record', { time: formatTime(dailyTime) })
          : dailyTime != null && dailyLeader
            ? t('index_daily_done_time_wr', { time: formatTime(dailyTime), wr: formatTime(dailyLeader.timeMs) })
            : dailyTime != null ? t('index_daily_done_time', { time: formatTime(dailyTime) }) : t('index_daily_done');
  const continueDetail = nextChallenge ? t(PROGRESSION_V2 ? 'home_solo_challenge' : 'relooking_continue_detail', {
    level: nextChallenge.level.id.replace('niveau_', ''),
    current: String(nextChallenge.challenge.challengeNumber),
  }) : undefined;
  const soloCaption = PROGRESSION_V2 && recommendedChapter && recommendedLevel !== null && !allCompleted
    ? t('home_solo_location', { chapter: String(recommendedChapter.id), level: String(recommendedLevel) })
    : t('index_solo_btn');
  const displayFont = fontFamily ? { fontFamily, fontWeight: 'normal' as const } : undefined;

  // ── Gardes ────────────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <View style={[styles.guardRoot, { paddingTop: Math.max(insets.top + 8, innerTop + 8) }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.guardRoot, { paddingTop: Math.max(insets.top + 8, innerTop + 8) }]}>
        <View style={styles.centered}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>{t('index_login_required')}</Text>
          <Text style={styles.lockDesc}>
            {t('index_login_required_desc')}
          </Text>
          <TouchableOpacity
            style={styles.btnLogin}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLoginText}>{t('index_btn_login')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Écran principal ───────────────────────────────────────────────────────
  return (
    <View style={StyleSheet.absoluteFill}>
      <BgImage />

      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top + 88, innerTop + 32), paddingBottom: frameBottom + insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View style={styles.challengeQuotaBadge} accessible>
            <Text style={[styles.challengeQuotaBadgeText, displayFont]}>
              {isFreePlayer
                ? t('challenge_quota_counter', { remaining: String(challengeRemaining), quota: String(challengeQuota) })
                : player.isPremium ? t('challenge_quota_unlimited') : t('challenge_quota_exempt')}
            </Text>
          </View>
          {isFreePlayer && challengeRemaining === 0 && (
            <View style={styles.challengeQuotaActions}>
              <TouchableOpacity
                style={styles.challengeQuotaPremium}
                onPress={() => setShowPremium(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.challengeQuotaActionText}>{t('challenge_quota_premium_btn')}</Text>
              </TouchableOpacity>
              {challengeRechargeAd.available && (
                <TouchableOpacity
                  style={[styles.challengeQuotaAd, challengeRechargeAd.busy && styles.challengeQuotaActionBusy]}
                  onPress={() => { void challengeRechargeAd.watch(); }}
                  disabled={challengeRechargeAd.busy}
                  activeOpacity={0.85}
                >
                  <Text style={styles.challengeQuotaActionText}>
                    {t('challenge_quota_ad_btn', { count: String(CHALLENGE_AD_RECHARGE_COUNT) })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── Défi Solo ── */}
        <Animated.View style={{ opacity: opaSolo, transform: [{ scale: scaleSolo }] }}>
          <View style={styles.soloButton}>
            <TexturedButton
              variant="green"
              caption={soloCaption}
              label={
                allCompleted
                  ? t('index_solo_all_done', { completed: String(totalCompleted), total: String(totalChallenges) })
                  : continueDetail
                    ? t('relooking_continue', { detail: continueDetail })
                    : t('index_solo_progress', { completed: String(totalCompleted), total: String(totalChallenges) })
              }
              accentText={!allCompleted ? continueDetail : undefined}
              fontSize={18}
              onPress={() => {
                if (nextChallenge) router.push(`/game/${nextChallenge.challenge.id}`);
              }}
              style={{ aspectRatio: 3.1, minHeight: 64 }}
            />
          </View>
          {PROGRESSION_V2 && (
            <View style={styles.soloProgressSection}>
              <View style={styles.soloProgressRow}>
                <Text style={[styles.soloProgressText, displayFont]}>
                  {soloLevelStatus.isCompleted
                    ? t('home_solo_levels_complete')
                    : t('home_solo_level_progress', {
                        current: String(soloLevelStatus.starsShown),
                        total: String(soloLevelStatus.threshold),
                        level: String(soloProgress.currentLevel),
                      })}
                </Text>
                <TouchableOpacity
                  style={styles.soloHelpButton}
                  onPress={() => setShowProgressHelp(visible => !visible)}
                  accessibilityRole="button"
                  accessibilityLabel={t('home_solo_help_label')}
                  accessibilityState={{ expanded: showProgressHelp }}
                >
                  <Text style={styles.soloHelpIcon}>?</Text>
                </TouchableOpacity>
              </View>
              {showProgressHelp && (
                <Text style={[styles.soloHelpText, displayFont]}>{t('home_solo_help_text')}</Text>
              )}
            </View>
          )}
        </Animated.View>

        <Animated.View style={{ opacity: opaDaily, transform: [{ scale: scaleDaily }, { scale: dailyFinished ? 1 : pulseAnim }] }}>
          <ParchmentBanner style={styles.soloButton}>
            <TouchableOpacity
              style={styles.dailyRelook}
              disabled={!dailyUnlocked || dailyFinished}
              onPress={() => {
                player.clearNewFeatureBadge('daily');
                router.push('/game/daily');
              }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !dailyUnlocked || dailyFinished }}
            >
              <View style={styles.dailyRelookText}>
                <Text style={[styles.relookTitle, displayFont]}>{t('index_daily_btn')}</Text>
                <Text style={[styles.relookSubtitle, displayFont]} numberOfLines={dailyUnlocked ? 2 : undefined}>{dailySublabel}</Text>
                {hasNewBadge('daily', player.newFeatureBadges) && dailyUnlocked && !dailyFinished && (
                  <Text style={[styles.relookSubtitle, displayFont]}>{t('ceremony_new_badge')}</Text>
                )}
              </View>
              {!dailyUnlocked ? (
                <View style={styles.dailyStatusIcon} accessible={false}>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
              ) : !dailyFinished ? (
                <Image source={RelookingAssets.flecheGo} style={styles.dailyArrow} resizeMode="contain" />
              ) : null}
            </TouchableOpacity>
            {dailyFinished && isAdminAccount(player.username) && (
              <TouchableOpacity style={styles.dailyReplayBtn} onPress={() => { player.resetDailyStatus(); router.push('/game/daily'); }}>
                <Text style={styles.dailyReplayText}>↺</Text>
              </TouchableOpacity>
            )}
          </ParchmentBanner>
        </Animated.View>

        {!player.isPremium && (
          <ParchmentBanner style={styles.premiumBanner}>
            <TouchableOpacity
              style={styles.premiumEntry}
              onPress={() => setShowPremium(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${t('premium_title')}. ${t('premium_home_benefit')}. ${t('premium_home_contribution')}. ${t('premium_home_price')}`}
            >
              <Image source={RelookingAssets.arbre} style={styles.premiumTree} resizeMode="contain" />
              <View style={styles.premiumText}>
                <Text style={[styles.premiumTitle, displayFont]}>{t('premium_title')}</Text>
                <Text style={[styles.premiumDetail, displayFont]}>{t('premium_home_benefit')}</Text>
                <Text style={[styles.premiumDetail, displayFont]}>{t('premium_home_contribution')}</Text>
              </View>
              <View style={styles.premiumPrice}>
                <Text style={[styles.premiumPriceText, displayFont]}>{t('premium_home_price')}</Text>
              </View>
            </TouchableOpacity>
          </ParchmentBanner>
        )}

        {/* ── Défi de la forêt — Planète Urgence 4×4 (avant le Journalier : il s'ouvre au chapitre 2, le Journalier au chapitre 3) ── */}
        <Animated.View style={{ opacity: opaOnf, transform: [{ scale: scaleOnf }] }}>
        {(() => {
          // Le Forestier s'ouvre avec le palier Sentier (fin du chapitre 2) ; compte démo exempté.
          const isOnfUnlocked = demoAccess.isOpen('onf_sentier');
          const onfSolved = player.onfSolvedCount;
          const cards     = getOwnedCardCount(player.collectedTreeCardIds);

          const lock = getLockMessageKey(demoAccess.lockHint('onf_sentier'));
          return (
            <View style={styles.forestCards}>
              <ParchmentBanner style={styles.forestCard}>
                <TouchableOpacity
                  style={styles.onfRelook}
                  disabled={!isOnfUnlocked}
                  onPress={() => {
                    player.clearNewFeatureBadge('onf');
                    router.push('/game/onf');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !isOnfUnlocked }}
                >
                  <Text style={[styles.forestCardTitle, displayFont]}>{t('index_onf_btn')}</Text>
                  <Text style={[styles.relookSubtitle, displayFont]}>
                    {isOnfUnlocked
                      ? onfSolved === 0
                        ? t('onf_btn_first_win')
                        : cards === 1
                          ? t('onf_btn_stats_one_card', { count: String(onfSolved) })
                          : cards > 1
                            ? t('onf_btn_stats_cards', { count: String(onfSolved), cards: String(cards) })
                            : t('onf_btn_stats_no_card', { count: String(onfSolved) })
                      : t(lock.key, lock.vars)}
                  </Text>
                  {isOnfUnlocked && hasNewBadge('onf', player.newFeatureBadges) && <Text style={[styles.relookSubtitle, displayFont]}>{t('ceremony_new_badge')}</Text>}
                  {isOnfUnlocked
                    ? <Image source={RelookingAssets.flecheGo} style={styles.forestCardArrow} resizeMode="contain" />
                    : <Text style={styles.lockIcon} accessible={false}>🔒</Text>}
                </TouchableOpacity>
              </ParchmentBanner>
              {PROGRESSION_V2 && (
                <ParchmentBanner style={styles.forestCard}>
                  <HerbierEntry compact />
                </ParchmentBanner>
              )}
            </View>
          );
        })()}
        </Animated.View>

        <Animated.View style={{ opacity: opaWidget, transform: [{ scale: scaleWidget }] }}>
          <ForetCommuneWidget />
        </Animated.View>

      </ScrollView>

      {/* ── Cérémonie de fin de chapitre (Progression v2, C7) ── */}
      <CeremonyModal
        visible={ceremony.visible}
        chapterId={ceremony.chapterId}
        language={player.language}
        seedsBefore={ceremony.seedsBefore}
        onClose={ceremony.onClose}
        onTryNow={() => {
          const destination = ceremony.onTryNow();
          if (destination !== '/(tabs)/') router.push(destination as any);
        }}
      />

      {/* ── PremiumCard (overlay modal) ── */}
      <PremiumCard
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onPurchase={() => {
          player.unlockPremium();
          setShowPremium(false);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  // ── Gardes ─────────────────────────────────────────────────────────────────
  guardRoot: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  lockEmoji: { fontSize: 48 },
  lockTitle: { fontSize: 20, fontWeight: '700', color: Colors.forest.dark, textAlign: 'center' },
  lockDesc:  { fontSize: 14, color: Colors.ui.textLight, textAlign: 'center', lineHeight: 20 },
  btnLogin: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnLoginText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Écran principal ─────────────────────────────────────────────────────────
  container: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dailyRelook: { minHeight: 65, flexDirection: 'row', alignItems: 'center' },
  dailyRelookText: { flex: 1, alignItems: 'center' },
  dailyArrow: { width: 42, height: 42 },
  dailyStatusIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { fontSize: 17 },
  soloButton: { width: '100%', maxWidth: 300, alignSelf: 'center' },
  soloProgressSection: { alignSelf: 'center', width: '100%', maxWidth: 330, marginTop: 3 },
  soloProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingLeft: 32 },
  soloProgressText: { flexShrink: 1, color: '#FFF8E7', fontSize: 12, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  soloHelpButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  soloHelpIcon: { width: 23, height: 23, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#D5B774', backgroundColor: '#315B34', color: '#FFF8E7', textAlign: 'center', fontSize: 15, fontWeight: '800' },
  soloHelpText: { color: '#24170E', backgroundColor: '#F4ECD8', borderColor: '#C4AE85', borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 18 },
  premiumBanner: { paddingHorizontal: 18, paddingVertical: 10 },
  premiumEntry: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumTree: { width: 34, height: 44 },
  premiumText: { flex: 1 },
  premiumTitle: { color: ForestColors.textInkPrimary, fontSize: 15, fontWeight: '800' },
  premiumDetail: { color: ForestColors.textInkPrimary, fontSize: 11, fontWeight: '700' },
  premiumPrice: { backgroundColor: '#315B34', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 8 },
  premiumPriceText: { color: '#FFF8E7', fontSize: 12, fontWeight: '800' },
  forestCards: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  forestCard: { flex: 1, width: 'auto', minWidth: 0, paddingHorizontal: 10, paddingVertical: 8 },
  onfRelook: { flex: 1, minHeight: 94, alignItems: 'center', justifyContent: 'center', gap: 2 },
  forestCardTitle: { fontSize: 16, fontWeight: '800', color: ForestColors.textInkPrimary, textAlign: 'center' },
  forestCardArrow: { width: 26, height: 26 },
  relookTitle: { fontSize: 18, fontWeight: '800', color: ForestColors.textInkPrimary, textAlign: 'center' },
  relookSubtitle: { fontSize: 12, fontWeight: '700', color: ForestColors.textInkPrimary, textAlign: 'center' },
  challengeQuotaBadge: {
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#315B34',
    borderWidth: 1,
    borderColor: '#D5B774',
  },
  challengeQuotaBadgeText: {
    color: '#FFF8E7',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  challengeQuotaActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  challengeQuotaPremium: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  challengeQuotaAd: {
    backgroundColor: '#7A5A24',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  challengeQuotaActionBusy: {
    opacity: 0.55,
  },
  challengeQuotaActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Défi du Jour — états non interactifs

  dailyDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' },

  dailyRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,160,23,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  dailyRecordText: { fontSize: 11, fontWeight: '700', color: '#FFD54F' },
  dailyReplayBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  dailyReplayText: { fontSize: 18, color: '#fff' },

  // ── Sous-écran niveaux ──────────────────────────────────────────────────────
  levelsHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  levelsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  levelsHeaderStars: { fontSize: 13, fontWeight: '700', color: '#FFE082', marginTop: 2 },
  chapterStrip: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  chapterChip: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  chapterChipActive: { borderColor: '#FFC107', borderWidth: 2, backgroundColor: 'rgba(255,193,7,0.2)' },
  chapterChipDone: { backgroundColor: 'rgba(76,175,80,0.28)', borderColor: 'rgba(139,195,74,0.7)' },
  chapterChipLocked: { opacity: 0.45 },
  chapterChipEmoji: { fontSize: 18 },
  chapterHeader: {
    alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14,
  },
  chapterTitle: { fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' },
  chapterSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  levelsContainer: { paddingHorizontal: 16, gap: 12 },

  // Navigateur de niveau
  levelNavigator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrowBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowBtnDisabled: { opacity: 0.25 },
  arrowText: { fontSize: 28, fontWeight: '300', color: '#fff', lineHeight: 32, marginTop: -2 },
  arrowTextDisabled: { color: 'rgba(255,255,255,0.4)' },

  levelCard: {
    flex: 1, borderRadius: 18, borderWidth: 2, padding: 14,
    alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(20,40,20,0.75)', overflow: 'hidden',
  },
  levelCardBg:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  levelCardEmoji: { fontSize: 32, marginBottom: 1 },
  levelCardLabel: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  levelCardDesc:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 4 },
  progressBarBg: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', minWidth: 30, textAlign: 'right' },

  dotsRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  dot:       { width: 6,  height: 6, borderRadius: 3 },
  dotActive: { width: 16, height: 6, borderRadius: 3 },

  lockedContainer: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32, gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16,
  },
  lockedEmoji:    { fontSize: 40 },
  lockedTitle:    { fontSize: 17, fontWeight: '800', color: '#fff' },
  lockedSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 18 },

  challengeList: { gap: 8 },
  challengeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,40,20,0.82)', borderRadius: 13,
    paddingVertical: 12, paddingRight: 14, paddingLeft: 0,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
  },
  challengeCardDone:   { borderColor: Colors.forest.accent + '90', backgroundColor: 'rgba(30,80,30,0.85)' },
  challengeCardLocked: { opacity: 0.45, backgroundColor: 'rgba(0,0,0,0.5)' },
  challengeAccent: {
    width: 4, alignSelf: 'stretch', marginRight: 10,
    borderTopLeftRadius: 13, borderBottomLeftRadius: 13,
  },
  challengeLeft:   { width: 30, alignItems: 'center' },
  challengeNumber: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  challengeCenter: { flex: 1, paddingLeft: 6 },
  challengeTitle:       { fontSize: 14, fontWeight: '600', color: '#fff' },
  challengeTitleLocked: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  challengeTimes:   { gap: 2, marginTop: 2 },
  challengeBestTime: { fontSize: 11, color: '#A5D6A7' },
  challengeWr:      { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  challengeNew:     { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  checkmark:        { fontSize: 16, color: Colors.forest.accent, fontWeight: '800', paddingLeft: 4 },
  challengeArrow:   { fontSize: 14, color: 'rgba(255,255,255,0.5)' },

  // ── Progression v2 (Lot 2) : jauge d'étoiles, défi conseillé, étoiles par défi ──
  starGaugeBlock: { width: '100%', gap: 2, marginTop: 4 },
  starGaugeLabel: { color: '#FFE082', minWidth: 52 },
  starGaugeHint:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 2 },
  challengeCardRecommended: { borderColor: '#FFC107', borderWidth: 2, backgroundColor: 'rgba(60,50,10,0.88)' },
  challengeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  recommendedBadge: {
    backgroundColor: '#FFC107', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  recommendedBadgeText: { fontSize: 10, fontWeight: '800', color: '#3E2F00', textTransform: 'uppercase', letterSpacing: 0.4 },
  challengeStars:   { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6 },
});
