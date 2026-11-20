// ============================================================
// VICTORYMODAL — migré vers react-native-reanimated (Progression v2, Lot 2)
//
// Séquence (C7), un tap passe à la fin :
//   1. pommes de pin (Solo uniquement, si `starResult` est fourni) : 3 emplacements avec leur
//      critère, vide → bois l'une après l'autre (vibration), puis,
//      si la 3e est obtenue, les 3 bois se transforment en dorées avec confettis (voir StarRow) ;
//      les pommes de pin nouvelles s'envolent vers le compteur (pomme de pin dorée) ;
//   2. jauge du niveau `x / seuil`, puis bandeau « Niveau N débloqué ! » si le seuil
//      vient d'être franchi ;
//   3. graines (puis PERFECT ×2 enchaîné après la 3e étoile).
//
// Les modes sans étoiles (Journalier, Forestier, Duel) n'envoient pas `starResult` :
// la séquence d'étoiles et la jauge sont alors absentes et les graines démarrent aussitôt.
//
// Affichée en SUPERPOSITION dans l'écran de jeu, et NON dans un `Modal` natif : empilé avec d'autres modales
// (déblocage de musique, record de série, roulette…), un `Modal` natif pouvait se fermer tout seul et laisser
// l'écran de jeu figé, sans aucun bouton cliquable. Une vue ordinaire ne peut pas être fermée par le système.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  LayoutChangeEvent,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { formatTime } from '../../utils/boardUtils';
import { Colors } from '../../constants/colors';
import { DifficultyLevel } from '../../core/models/Challenge';
import { notificationSuccess } from '../../utils/haptics';
import { Confetti, ConfettiPiece } from './Confetti';
import { pickTrophyHint } from '../../constants/trophyHint';
import { BADGE_MAP, getTrophyTexts } from '../../constants/badges';
import { getSeries } from '../../constants/trophies';
import type { TrophyProgress } from '../../constants/trophies';
import { BadgeToast } from '../Badges/BadgeToast';
import { WorldRecord } from '../../services/worldRecordService';
import { usePlayerStore } from '../../store/playerStore';
import { RewardFly, useCounterPulse } from './RewardFly';
import { StarRow, StarSlotLayout } from './StarRow';
import { PineconeIcon, PineconeText } from './PineconeIcon';
import {
  LevelGaugeResult,
  StarSequence,
  getStarSequenceDuration,
} from '../../constants/progression';
import { useT } from '../../i18n';
import { useHomeFont } from '../../theme/homeTypography';

/** Données Solo de la séquence d'étoiles. Absentes pour Journalier / Forestier / Duel. */
export interface VictoryStarResult {
  sequence: StarSequence;
  gauge: LevelGaugeResult;
  /** true si le défi a déjà été gagné avant : message « graines seulement pour les nouvelles étoiles ». */
  isReplay: boolean;
}

interface VictoryModalProps {
  visible: boolean;
  elapsedTime: number;
  seedsEarned: number;
  seedsBeforeGain?: number;
  rewardNote?: string;
  difficulty: DifficultyLevel;
  challengeNumber: number;
  onNextChallenge: () => void;
  nextChallengeLabel?: string;
  /** Bouton secondaire optionnel (Solo : « Continuer le niveau N »), affiché entre le principal et « Retour au menu ». */
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  showBackToMenu?: boolean;
  onBackToMenu: () => void;
  confettiPieces?: ConfettiPiece[];
  /** « Prochains trophées » (3 au plus) avec leur progression (Progression v2, C8). */
  nextTrophies?: TrophyProgress[];
  obtainedBadgeIds?: string[];
  badgeQueue?: string[];
  onBadgeQueueEmpty?: () => void;
  worldRecord?: WorldRecord | null;
  isNewWorldRecord?: boolean;
  previousRecordHolder?: string | null;
  // ── PERFECT x2 ────────────────────────────────────────────────────────────
  isPerfectRun?: boolean;
  perfectSeedsBonus?: number;
  onPerfectBonusCollected?: () => void;
  // ── Étoiles (Progression v2, Solo uniquement) ─────────────────────────────
  starResult?: VictoryStarResult | null;
}

const DIFFICULTY_EMOJIS: Partial<Record<DifficultyLevel, string>> = {
  niveau_1: '🌱', niveau_2: '🌿', niveau_3: '🌳',
  niveau_4: '🦊', niveau_5: '🏕️', niveau_6: '🌲',
  niveau_7: '🐺', niveau_8: '🏔️', niveau_9: '🏹',
  niveau_10: '🐽', niveau_11: '🏔️',
  niveau_12: '⚡', niveau_13: '💀',
};

export const VictoryModal: React.FC<VictoryModalProps> = ({
  visible, elapsedTime, seedsEarned, seedsBeforeGain, rewardNote, difficulty, challengeNumber,
  onNextChallenge, nextChallengeLabel, onSecondaryAction, secondaryActionLabel,
  showBackToMenu = true, onBackToMenu, confettiPieces,
  nextTrophies = [], obtainedBadgeIds = [], badgeQueue = [], onBadgeQueueEmpty,
  worldRecord = null, isNewWorldRecord = false, previousRecordHolder = null,
  isPerfectRun = false, perfectSeedsBonus = 0, onPerfectBonusCollected,
  starResult = null,
}) => {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const language = usePlayerStore(s => s.language);
  const fontFamily = useHomeFont();

  // Ligne « trophée » unique (voir trophyHint.ts) : un trophée obtenu ce tour, sinon un trophée tout proche.
  const hint = pickTrophyHint(obtainedBadgeIds, nextTrophies);
  const trophyLine = (() => {
    if (!hint) return null;
    const def = BADGE_MAP[hint.trophyId];
    if (!def) return null;
    const name = getTrophyTexts(def, language, t).label;
    if (hint.kind === 'earned') {
      return hint.extra > 0
        ? t('victory_trophy_earned_more', { name, count: String(hint.extra) })
        : t('victory_trophy_earned', { name });
    }
    const series = getSeries(hint.seriesId);
    return t('victory_trophy_near', { name: series ? t(series.nameKey) : name, remaining: String(hint.remaining) });
  })();

  // ── Compteur de graines affiché ──────────────────────────────────────────
  // totalSeeds = vrai total incluant le gain (addSeeds déjà appelé)
  // Si seedsBeforeGain est fourni, on l'utilise comme point de départ de l'animation.
  const totalSeeds = usePlayerStore(s => s.seeds);
  const startSeeds = seedsBeforeGain ?? (totalSeeds - seedsEarned);
  const [displayedSeeds, setDisplayedSeeds] = useState(startSeeds);
  const [displayedGain, setDisplayedGain]   = useState(seedsEarned);
  const [animDone, setAnimDone]             = useState(false);
  const arrivedCount  = useRef(0);
  // Nombre de particules capturé au démarrage de la 1re animation (stable, ne change pas mid-vol)
  const launchedCount = useRef(0);

  // ── Phase de la séquence ─────────────────────────────────────────────────
  // 'stars' → étoiles qui pop ; 'gauge' → jauge + bandeau ; 'seeds' → graines (puis PERFECT).
  // Sans `starResult`, on saute directement à 'seeds'.
  const hasStars = !!starResult;
  const [phase, setPhase] = useState<'stars' | 'gauge' | 'seeds'>(hasStars ? 'stars' : 'seeds');
  const [skip, setSkip] = useState(false);
  const [starsFinished, setStarsFinished] = useState(!hasStars);
  const [gaugeShown, setGaugeShown] = useState(false);
  const [gaugeValue, setGaugeValue] = useState(starResult?.gauge.shownBefore ?? 0);

  useEffect(() => {
    if (visible) {
      const start = seedsBeforeGain ?? (totalSeeds - seedsEarned);
      setDisplayedSeeds(start);
      setDisplayedGain(seedsEarned);
      setAnimDone(false);
      arrivedCount.current = 0;
      setPhase(hasStars ? 'stars' : 'seeds');
      setSkip(false);
      setStarsFinished(!hasStars);
      setGaugeShown(false);
      setGaugeValue(starResult?.gauge.shownBefore ?? 0);
    }
  }, [visible]);

  // starResult DOIT être fourni dès le premier rendu visible (le parent le calcule dans un
  // useMemo, avant que le useEffect de victoire ne mette le store à jour) : la séquence est
  // décidée à l'ouverture et ne change plus ensuite.

  // Mise à jour du gain affiché si seedsEarned change après l'ouverture
  // (cas : badges + rang calculés dans le useEffect de [challengeId].tsx après isVictory)
  // On ne réinitialise que si l'animation n'a pas encore démarré (arrivedCount = 0).
  useEffect(() => {
    if (visible && arrivedCount.current === 0) {
      setDisplayedGain(seedsEarned);
    }
  }, [seedsEarned]);

  useEffect(() => {
    if (visible) {
      notificationSuccess();
    }
  }, [visible]);

  // ── Positions mesurées dans la carte (via onLayout) ───────────────────────
  const [fromY, setFromY] = useState<number | null>(null);
  const [fromX, setFromX] = useState<number>(225);
  const [toY, setToY]     = useState<number | null>(null);
  const [toX, setToX]     = useState<number>(150);

  // Repères : les récompenses volantes sont positionnées dans la CARTE (absoluteFill, padding
  // compris), alors que les onLayout sont relatifs à leur parent direct. On mesure donc
  //   - l'origine de cardInner dans la carte (= son padding) ;
  //   - l'origine de la rangée de compteurs dans cardInner.
  const [cardOrigin, setCardOrigin] = useState({ x: 0, y: 0 });
  const onCardInnerLayout = useCallback((e: LayoutChangeEvent) => {
    setCardOrigin({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y });
  }, []);
  const [countersOrigin, setCountersOrigin] = useState({ x: 0, y: 0 });
  const onCountersRowLayout = useCallback((e: LayoutChangeEvent) => {
    setCountersOrigin({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y });
  }, []);

  const onCounterLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setToY(y + height / 2);
    setToX(x + width / 2);
  }, []);

  const onStatsLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setFromY(y + height / 2);
    setFromX(x + width * 0.75);
  }, []);

  // Position du bloc d'étoiles et du compteur ⭐ de la carte (cible du vol des étoiles)
  const [starsBlockY, setStarsBlockY] = useState(0);
  const [starCounterLocal, setStarCounterLocal] = useState<{ x: number; y: number } | null>(null);
  const starCounter = starCounterLocal
    ? {
        x: starCounterLocal.x + countersOrigin.x + cardOrigin.x,
        y: starCounterLocal.y + countersOrigin.y + cardOrigin.y,
      }
    : null;
  // Cible des graines : compteur 🌱, converti dans le repère de la carte.
  const seedTargetX = toX + countersOrigin.x + cardOrigin.x;
  const seedTargetY = toY !== null ? toY + countersOrigin.y + cardOrigin.y : null;
  // Origine des graines : bloc des stats (enfant direct de cardInner).
  const seedFromX = fromX + cardOrigin.x;
  const seedFromY = fromY !== null ? fromY + cardOrigin.y : null;
  const onStarCounterLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setStarCounterLocal({ x: x + width / 2, y: y + height / 2 });
  }, []);

  // ── Pulses ────────────────────────────────────────────────────────────────
  const seedPulse = useCounterPulse();
  const starPulse = useCounterPulse();

  // ── Étoiles : vol vers le compteur ⭐ ─────────────────────────────────────
  const [starFlights, setStarFlights] = useState<Array<{ key: number; x: number; y: number }>>([]);
  const starFlightKey = useRef(0);
  const [displayedStars, setDisplayedStars] = useState(0);

  const handleStarPopped = useCallback((slot: StarSlotLayout) => {
    if (!starResult) return;
    // Départ : centre de l'étoile dans le repère de la carte ; arrivée : compteur ⭐.
    const key = ++starFlightKey.current;
    setStarFlights(f => [...f, {
      key,
      x: cardOrigin.x + slot.centerX,
      y: cardOrigin.y + starsBlockY + slot.centerY,
    }]);
  }, [starResult, starsBlockY, cardOrigin]);

  const onStarArrived = useCallback(() => {
    setDisplayedStars(n => n + 1);
    starPulse.pulse();
  }, [starPulse]);

  // ── Fin de la séquence d'étoiles → jauge ─────────────────────────────────
  const onStarsFinished = useCallback(() => {
    setStarsFinished(true);
  }, []);

  useEffect(() => {
    if (!visible || !starResult || !starsFinished) return;
    // Laisse juste le temps à la dernière étoile d'arriver (ou saute si le joueur a tapé).
    const wait = skip || reduceMotion ? 0 : 250;
    const t1 = setTimeout(() => {
      setPhase('gauge');
      setGaugeShown(true);
      setGaugeValue(starResult.gauge.shownAfter);
      if (starResult.gauge.justCompleted) {
        AccessibilityInfo.announceForAccessibility(
          starResult.gauge.unlockedLevel
            ? t('victory_level_unlocked', { level: String(starResult.gauge.unlockedLevel) })
            : t('victory_level_completed_last'),
        );
      }
    }, wait);
    // Puis les graines, après la jauge et (éventuellement) le bandeau.
    const afterGauge = skip || reduceMotion ? 50 : starResult.gauge.justCompleted ? 800 : 380;
    const t2 = setTimeout(() => setPhase('seeds'), wait + afterGauge);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, starResult, starsFinished, skip]);

  // ── Jauge animée ──────────────────────────────────────────────────────────
  const gaugeRatio = useSharedValue(0);
  const threshold = starResult?.gauge.threshold ?? 0;
  useEffect(() => {
    const target = threshold > 0 ? gaugeValue / threshold : 0;
    gaugeRatio.value = reduceMotion || skip
      ? target
      : withTiming(target, { duration: 500, easing: Easing.out(Easing.quad) });
  }, [gaugeValue, threshold, reduceMotion, skip]);
  const gaugeStyle = useAnimatedStyle(() => ({ width: `${Math.min(1, gaugeRatio.value) * 100}%` }));

  // ── Bandeau « Niveau N débloqué » ────────────────────────────────────────
  const bannerScale = useSharedValue(0);
  const bannerOpacity = useSharedValue(0);
  const showBanner = !!starResult?.gauge.justCompleted && gaugeShown;
  useEffect(() => {
    if (!showBanner) {
      bannerScale.value = 0;
      bannerOpacity.value = 0;
      return;
    }
    if (reduceMotion || skip) {
      bannerScale.value = 1;
      bannerOpacity.value = withTiming(1, { duration: 150 });
      return;
    }
    bannerOpacity.value = withDelay(350, withTiming(1, { duration: 150 }));
    bannerScale.value = withDelay(350, withSpring(1, { damping: 8, stiffness: 220 }));
  }, [showBanner, reduceMotion, skip]);
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));

  // ── Callback : une graine arrive au compteur ──────────────────────────────
  const [showPerfectOverlay, setShowPerfectOverlay] = useState(false);
  const [perfectBonusAdded, setPerfectBonusAdded] = useState(false);

  const onSeedArrived = useCallback(() => {
    arrivedCount.current += 1;
    setDisplayedSeeds(prev => prev + 1);
    setDisplayedGain(prev => Math.max(0, prev - 1));
    seedPulse.pulse();
    // Comparaison sur launchedCount.current (stable), pas sur seedsEarned (peut changer)
    if (arrivedCount.current >= launchedCount.current) {
      setAnimDone(true);
      // Si run parfait : déclencher l'overlay après la fin de la 1re animation
      if (isPerfectRun && perfectSeedsBonus > 0) {
        setTimeout(() => setShowPerfectOverlay(true), 500);
      }
    }
  }, [seedPulse, isPerfectRun, perfectSeedsBonus]);

  // ── Déclenchement des graines : uniquement en phase 'seeds' ──────────────
  const [flyKey, setFlyKey]   = useState(0);
  const [flyActive, setFlyActive] = useState(false);
  // particleCount est figé au moment du lancement — ne dépend pas de seedsEarned changeant
  const [particleCount, setParticleCount] = useState(0);
  // Ref pour éviter le double-déclenchement si seedsEarned change pendant le délai de 600ms
  const flyScheduledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setFlyActive(false);
      flyScheduledRef.current = false;
      return;
    }
    if (phase !== 'seeds') return;
    // Pas de graines → animDone immédiatement après l'animation d'entrée de la carte
    if (seedsEarned <= 0) {
      const tm = setTimeout(() => setAnimDone(true), 700);
      return () => clearTimeout(tm);
    }
    // Ne pas re-déclencher si déjà planifié ou en cours
    if (flyScheduledRef.current || flyActive) return;
    flyScheduledRef.current = true;
    // Capturer la valeur au moment de la planification
    const count = Math.max(1, seedsEarned);
    let fired = false;
    const tm = setTimeout(() => {
      fired = true;
      setParticleCount(count);
      launchedCount.current = count;
      arrivedCount.current  = 0;
      setFlyKey(k => k + 1);
      setFlyActive(true);
    }, hasStars ? 80 : 600);
    return () => {
      clearTimeout(tm);
      // Minuteur annulé (la phase a changé avant l'envol) : libérer la planification,
      // sinon les graines ne partiraient jamais.
      if (!fired) flyScheduledRef.current = false;
    };
  }, [visible, seedsEarned, phase]);

  // ── PERFECT x2 ────────────────────────────────────────────────────────────
  const [perfectFlyActive, setPerfectFlyActive]     = useState(false);
  const [perfectFlyKey, setPerfectFlyKey]           = useState(0);
  const perfectScale = useSharedValue(0);
  const perfectOpacity = useSharedValue(0);

  // Reset à chaque ouverture/fermeture
  useEffect(() => {
    if (!visible) {
      setShowPerfectOverlay(false);
      setPerfectBonusAdded(false);
      setPerfectFlyActive(false);
      setStarFlights([]);
      setDisplayedStars(0);
      starFlightKey.current = 0;
      cancelAnimation(perfectScale);
      cancelAnimation(perfectOpacity);
      perfectScale.value = 0;
      perfectOpacity.value = 0;
    }
  }, [visible]);

  // Lancer l'animation PERFECT quand showPerfectOverlay passe à true
  useEffect(() => {
    if (!showPerfectOverlay) return;
    perfectScale.value = 0;
    perfectOpacity.value = 0;
    const afterAppear = () => {
      // Réafficher le gain bonus dans le label stats
      if (perfectSeedsBonus > 0) setDisplayedGain(perfectSeedsBonus);
      // Appeler le callback pour addSeeds côté parent (le x2 effectif)
      onPerfectBonusCollected?.();
      setPerfectBonusAdded(true);
      // Délai visuel avant de lancer la 2e pluie de graines
      setTimeout(() => {
        setPerfectFlyKey(k => k + 1);
        setPerfectFlyActive(true);
      }, 400);
    };
    if (reduceMotion) {
      perfectScale.value = 1;
      perfectOpacity.value = withTiming(1, { duration: 200 });
      const tm = setTimeout(afterAppear, 220);
      return () => clearTimeout(tm);
    }
    perfectOpacity.value = withTiming(1, { duration: 200 });
    perfectScale.value = withSpring(1, { damping: 7, stiffness: 200 });
    const tm = setTimeout(afterAppear, 520);
    return () => clearTimeout(tm);
  }, [showPerfectOverlay]);

  const perfectStyle = useAnimatedStyle(() => ({
    opacity: perfectOpacity.value,
    transform: [{ scale: perfectScale.value }],
  }));

  // ── Tap pour passer la séquence ──────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (!visible || !hasStars || skip || phase === 'seeds') return;
    setSkip(true);
  }, [visible, hasStars, skip, phase]);

  const sequenceActive = hasStars && phase !== 'seeds';

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (!visible) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.cardFrame}>
        <ScrollView style={styles.cardScroll} showsVerticalScrollIndicator>
        <View style={styles.card}>
          <TouchableWithoutFeedback onPress={handleSkip} disabled={!sequenceActive}>
            <View style={styles.cardInner} onLayout={onCardInnerLayout}>

              {/* ── Compteurs : ⭐ (si étoiles) et 🌱 — CIBLES des récompenses ───── */}
              <View style={styles.countersRow} onLayout={onCountersRowLayout}>
                {hasStars && (
                  <View style={styles.counterWrapper} onLayout={onStarCounterLayout}>
                    <Animated.View style={[styles.halo, styles.haloStar, starPulse.haloStyle]} pointerEvents="none" />
                    <Animated.View
                      style={[styles.counterBadge, styles.starCounterBadge, starPulse.counterStyle]}
                      accessible
                      accessibilityLabel={t('frame_stars_a11y', { count: String(displayedStars) })}
                    >
                      <PineconeIcon size={26} variant="gold" />
                      <Text style={styles.counterValue}>+{displayedStars}</Text>
                    </Animated.View>
                  </View>
                )}
                <View style={styles.counterWrapper} onLayout={onCounterLayout}>
                  {/* Halo vert qui pulse */}
                  <Animated.View style={[styles.halo, seedPulse.haloStyle]} pointerEvents="none" />
                  <Animated.View style={[styles.seedCounterBadge, seedPulse.counterStyle]}>
                    <Text style={styles.seedCounterValue}>{displayedSeeds}</Text>
                    <Text style={styles.seedCounterEmoji}>🌱</Text>
                    {displayedGain > 0 && !animDone && (
                      <View style={styles.seedGainBubble}>
                        <Text style={styles.seedGainText}>+{displayedGain}</Text>
                      </View>
                    )}
                  </Animated.View>
                </View>
              </View>

              {/* ── Titre ────────────────────────────────────────────────────── */}
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={styles.emoji}>🎉</Text>
                <Text style={[styles.title, fontFamily && { fontFamily, fontWeight: 'normal' }]}>{t('victory_title')}</Text>
                {challengeNumber > 0 && (
                  <Text style={styles.subtitle}>
                    {DIFFICULTY_EMOJIS[difficulty] ?? ''} {t('level_prefix')} {difficulty.replace('niveau_', '')} — {t('victory_challenge_label', { number: String(challengeNumber) })}
                  </Text>
                )}
              </View>

              {showPerfectOverlay && (
                <Animated.View
                  style={[styles.perfectOverlay, perfectStyle]}
                  pointerEvents="none"
                  accessible
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`${t('perfect_run_label')} ${t('perfect_run_gain_x2')}`}
                >
                  <Text style={styles.perfectLabel}>{t('perfect_run_label')}</Text>
                  <Text style={styles.perfectSub}>{t('perfect_run_gain_x2')}</Text>
                </Animated.View>
              )}

              {/* ── Étoiles (Solo) ───────────────────────────────────────────── */}
              {starResult && (
                <View
                  style={styles.starsBlock}
                  onLayout={(e) => setStarsBlockY(e.nativeEvent.layout.y)}
                >
                  <StarRow
                    sequence={starResult.sequence}
                    play={visible}
                    skip={skip}
                    onStarPopped={handleStarPopped}
                    onFinished={onStarsFinished}
                  />

                  {/* Jauge du niveau x / seuil */}
                  <View
                    style={styles.gaugeBlock}
                    accessible
                    accessibilityLabel={t('victory_level_gauge_a11y', {
                      level: String(starResult.gauge.level),
                      current: String(gaugeValue),
                      threshold: String(starResult.gauge.threshold),
                    })}
                    accessibilityLiveRegion="polite"
                  >
                    <PineconeText
                      style={styles.gaugeText}
                      text={t('victory_level_gauge', {
                        level: String(starResult.gauge.level),
                        current: String(gaugeValue),
                        threshold: String(starResult.gauge.threshold),
                      })}
                    />
                    <View style={styles.gaugeBg}>
                      <Animated.View style={[styles.gaugeFill, gaugeStyle]} />
                    </View>
                  </View>

                  {/* Bandeau « Niveau N débloqué ! » */}
                  {showBanner && (
                    <Animated.View
                      style={[styles.levelBanner, bannerStyle]}
                      accessible
                      accessibilityRole="alert"
                      accessibilityLabel={
                        starResult.gauge.unlockedLevel
                          ? t('victory_level_unlocked', { level: String(starResult.gauge.unlockedLevel) })
                          : t('victory_level_completed_last')
                      }
                    >
                      <Text style={styles.levelBannerText}>
                        🔓 {starResult.gauge.unlockedLevel
                          ? t('victory_level_unlocked', { level: String(starResult.gauge.unlockedLevel) })
                          : t('victory_level_completed_last')}
                      </Text>
                    </Animated.View>
                  )}

                  {starResult.isReplay && (
                    <Text style={styles.replayNote}>{t('victory_replay_no_seeds')}</Text>
                  )}
                  {sequenceActive && (
                    <Text style={styles.skipHint}>{t('victory_skip_hint')}</Text>
                  )}
                </View>
              )}

              {/* ── Stats — SOURCE ────────────────────────────────────────────── */}
              <View style={styles.statsRow} onLayout={onStatsLayout}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
                  <Text style={styles.statLabel}>{t('victory_stat_time')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>+{seedsEarned + (perfectBonusAdded ? perfectSeedsBonus : 0)} 🌱</Text>
                  <Text style={styles.statLabel}>{t('victory_stat_seeds')}</Text>
                </View>
              </View>

              {rewardNote ? (
                <Text style={styles.rewardNote} accessibilityLiveRegion="polite">
                  {rewardNote}
                </Text>
              ) : null}

              {/* ── Record mondial ───────────────────────────────────────────── */}
              {isNewWorldRecord ? (
                <View style={styles.wrBanner}>
                  <Text style={styles.wrBannerEmoji}>🌍🏆</Text>
                  <View style={styles.wrBannerText}>
                    <Text style={styles.wrBannerTitle}>{t('wr_new_record')}</Text>
                    <Text style={styles.wrBannerTime}>{formatTime(elapsedTime)}</Text>
                    {previousRecordHolder && (
                      <Text style={styles.wrPreviousHolder}>{t('wr_beaten_from', { username: previousRecordHolder })}</Text>
                    )}
                  </View>
                </View>
              ) : worldRecord ? (
                <View style={styles.wrInfo}>
                  <Text style={styles.wrInfoLabel}>{t('wr_record_label')}</Text>
                  <Text style={styles.wrInfoTime}>{formatTime(worldRecord.timeMs)}</Text>
                  <Text style={styles.wrInfoHolder}>{t('wr_held_by', { username: worldRecord.username })}</Text>
                </View>
              ) : null}

              {/* Une seule ligne « trophée » (obtenu ce tour, ou tout proche) : le détail est dans le Profil */}
              {trophyLine && (
                <View
                  style={styles.trophyLine}
                  accessible
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={trophyLine}
                >
                  <Text style={styles.trophyLineText}>{trophyLine}</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.button, styles.btnPrimarySurface]} onPress={onNextChallenge} activeOpacity={0.8} accessibilityRole="button">
                <View style={[styles.buttonInner, styles.btnPrimaryInner]}>
                  <Text style={styles.btnPrimaryText}>{nextChallengeLabel ?? t('victory_next_challenge')}</Text>
                </View>
              </TouchableOpacity>
              {onSecondaryAction && secondaryActionLabel ? (
                <TouchableOpacity style={[styles.button, styles.btnOutlineSurface]} onPress={onSecondaryAction} activeOpacity={0.8} accessibilityRole="button">
                  <View style={[styles.buttonInner, styles.btnOutlineInner]}>
                    <Text style={styles.btnOutlineText}>{secondaryActionLabel}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {showBackToMenu && (
                <TouchableOpacity style={styles.btnSecondary} onPress={onBackToMenu} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={styles.btnSecondaryText}>{t('victory_back_menu')}</Text>
                </TouchableOpacity>
              )}

            </View>
          </TouchableWithoutFeedback>

          {/*
            Récompenses volantes — absoluteFill dans la carte.
            Les positions sont dans le référentiel de la carte (via onLayout) : même parent,
            même système de coordonnées. flyKey force le remontage si on rejoue.
          */}
          {starFlights.map(f => (
            starCounter && (
              <RewardFly
                key={`star_${f.key}`}
                target="stars"
                count={1}
                fromX={f.x}
                fromY={f.y}
                targetX={starCounter.x}
                targetY={starCounter.y}
                onArrived={onStarArrived}
              />
            )
          ))}

          {flyActive && seedFromY !== null && seedTargetY !== null && (
            <RewardFly
              key={flyKey}
              target="seeds"
              count={particleCount}
              fromX={seedFromX}
              fromY={seedFromY}
              targetX={seedTargetX}
              targetY={seedTargetY}
              onArrived={onSeedArrived}
            />
          )}

          {/* ── 2e pluie de graines (bonus parfait) ─────────────────────── */}
          {perfectFlyActive && seedFromY !== null && seedTargetY !== null && (
            <RewardFly
              key={`perfect_${perfectFlyKey}`}
              target="seeds"
              count={Math.max(1, perfectSeedsBonus)}
              fromX={seedFromX}
              fromY={seedFromY}
              targetX={seedTargetX}
              targetY={seedTargetY}
              onArrived={() => {
                setDisplayedSeeds(prev => prev + 1);
                setDisplayedGain(prev => Math.max(0, prev - 1));
                seedPulse.pulse();
              }}
            />
          )}

        </View>
        </ScrollView>
        </View>
      </View>

      <Confetti pieces={confettiPieces ?? null} />

      {badgeQueue.length > 0 && onBadgeQueueEmpty && (
        <BadgeToast queue={badgeQueue} onQueueEmpty={onBadgeQueueEmpty} />
      )}

    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,25,14,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardFrame: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    flexShrink: 1,
    borderWidth: 6,
    borderColor: '#734B2C',
    borderRadius: 18,
    backgroundColor: '#E8C697',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 16,
    overflow: 'hidden',
  },
  cardScroll: { flexGrow: 0, flexShrink: 1 },
  card: {
    backgroundColor: '#F7E7C9',
    borderWidth: 1,
    borderColor: '#D5B58B',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
    width: '100%',
    overflow: 'visible',
  },
  cardInner: { width: '100%', alignItems: 'center' },

  // ── Compteurs ─────────────────────────────────────────────────────────────
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  counterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 90,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6FCF5A',
  },
  haloStar: { backgroundColor: '#FFC107' },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  starCounterBadge: {
    backgroundColor: '#5A4300',
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  counterEmoji: { fontSize: 20 },
  counterValue: { fontSize: 20, fontWeight: '800', color: '#FFE082', minWidth: 28, textAlign: 'center' },
  seedCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest.dark,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: Colors.forest.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  seedCounterValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF8E7',
    minWidth: 28,
    textAlign: 'center',
  },
  seedCounterEmoji: { fontSize: 20 },
  seedGainBubble: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.forest.accent,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  seedGainText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // ── Titre ─────────────────────────────────────────────────────────────────
  emoji: { fontSize: 36 },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#79401F',
    textAlign: 'center',
    textShadowColor: '#E5B16B',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
    marginBottom: 2,
  },
  subtitle: { fontSize: 15, fontWeight: '700', color: '#572E1D', textAlign: 'center', marginBottom: 14 },

  // ── Étoiles et jauge ──────────────────────────────────────────────────────
  starsBlock: { width: '100%', alignItems: 'center', marginBottom: 14 },
  gaugeBlock: { width: '100%', marginTop: 10 },
  gaugeText: { fontSize: 12, fontWeight: '700', color: '#572E1D', marginBottom: 4, textAlign: 'center' },
  gaugeBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D5B58A',
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: 5, backgroundColor: '#DB9A25' },
  levelBanner: {
    marginTop: 10,
    backgroundColor: '#A16B43',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#FFF1D5',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  levelBannerText: { color: '#FFF8E7', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  replayNote: { marginTop: 8, fontSize: 11, color: '#684831', textAlign: 'center', fontStyle: 'italic' },
  skipHint: { marginTop: 6, fontSize: 11, color: '#684831' },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAD1AA',
    borderColor: '#C9A97E',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    width: '100%',
  },
  rewardNote: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 12,
    color: Colors.forest.medium,
    fontWeight: '600',
    textAlign: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#572E1D' },
  statLabel: { fontSize: 12, color: '#684831', marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: '#BD9B70', marginHorizontal: 8 },

  // ── Boutons ───────────────────────────────────────────────────────────────
  button: {
    width: '100%',
    marginBottom: 8,
    padding: 2,
    borderWidth: 1,
    borderBottomWidth: 4,
    borderRadius: 12,
  },
  buttonInner: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  btnPrimarySurface: { backgroundColor: '#285832', borderColor: '#1C4027' },
  btnPrimaryInner: { backgroundColor: '#397B40', borderColor: '#60935D' },
  btnOutlineSurface: { backgroundColor: '#A7764F', borderColor: '#794C31' },
  btnOutlineInner: { backgroundColor: '#F1D9B3', borderColor: '#FAEBD2' },
  btnPrimaryText: { color: '#FFFDF5', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  btnOutlineText: { color: '#572E1D', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  btnSecondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  btnSecondaryText: { color: '#572E1D', fontSize: 14, fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' },

  trophyLine: {
    width: '100%',
    backgroundColor: '#F4DEAA',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  trophyLineText: { fontSize: 13, fontWeight: '700', color: '#572E1D', textAlign: 'center' },

  // ── PERFECT ───────────────────────────────────────────────────────────────
  perfectOverlay: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,46,27,0.92)',
    borderRadius: 16,
    paddingVertical: 6,
    marginBottom: 10,
  },
  perfectLabel: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFD700',
    textAlign: 'center',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  perfectSub: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF8E7',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  wrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.badges.or + '20',
    borderWidth: 1.5,
    borderColor: Colors.badges.or,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
    gap: 10,
  },
  wrBannerEmoji: { fontSize: 28 },
  wrBannerText: { flex: 1 },
  wrBannerTitle: {
    fontSize: 13, fontWeight: '800', color: Colors.badges.or,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  wrBannerTime: { fontSize: 20, fontWeight: '800', color: Colors.forest.dark },
  wrPreviousHolder: { fontSize: 11, color: Colors.badges.or, fontStyle: 'italic', marginTop: 2 },
  wrInfo: {
    backgroundColor: '#F1DFC1',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wrInfoLabel: { fontSize: 11, fontWeight: '700', color: '#684831', flex: 1 },
  wrInfoTime: { fontSize: 14, fontWeight: '800', color: '#572E1D' },
  wrInfoHolder: { fontSize: 11, color: '#684831', flexShrink: 1 },
});
