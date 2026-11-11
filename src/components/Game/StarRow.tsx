// ============================================================
// StarRow — les 3 pommes de pin d'un défi, avec leur critère écrit dessous (Progression v2, C7)
//
// Les « étoiles » sont des pommes de pin (thème forestier) :
//   vide (PP_vide2) = non obtenue · bois (PP_bois) = 1 ou 2 obtenues · dorée (PP_or) = les 3 obtenues.
//
// Séquence :
//   - les pommes de pin NOUVELLES passent de vide à bois l'une après l'autre (pop, note de plus en plus
//     aiguë, vibration légère, moyenne pour la 3e) ;
//   - si la 3e (« Parfait ») est obtenue CE TOUR-CI : après un court temps d'arrêt, les trois bois se
//     transforment ensemble en dorées, avec un pulse et une gerbe de confettis / feu d'artifice ;
//   - défi déjà à 3 (rien de nouveau) : les trois dorées sont affichées d'emblée, sans fête ;
//   - émet la position de chaque pomme de pin nouvelle pour que le parent l'envoie vers le compteur ;
//   - « réduire les animations » : fondus à la place des pops, pas de confettis ; vibrations conservées.
//
// Un tap sur la rangée (ou `skip` à true) passe directement à l'état final.
// `onFinished` est appelé une fois, APRÈS la fête s'il y en a une.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  STAR_CRITERIA_KEYS,
  STAR_NOTE_RATES,
  StarSequence,
  StarSlotState,
  getStarHaptic,
  getStarPopDelays,
} from '../../constants/progression';
import {
  PINECONE_CELEBRATION_MS,
  PINECONE_TRANSFORM_DELAY_MS,
  PINECONE_TRANSFORM_DURATION_MS,
  isStaticGold,
  shouldTransform,
} from '../../constants/pinecone';
import { impactLight, impactMedium, notificationSuccess } from '../../utils/haptics';
import { playStarTone } from '../../services/starSoundService';
import { useT } from '../../i18n';
import { PineconeIcon } from './PineconeIcon';
import { BurstShot, PineconeBurst } from './PineconeBurst';

/** Hauteur d'une pomme de pin (la largeur suit : ≈ 0,8 × la hauteur). */
const PINE_H = 56;

export interface StarSlotLayout {
  /** Index de l'emplacement (0 à 2). */
  index: number;
  /** Centre de la pomme de pin, dans le repère du conteneur de `StarRow`. */
  centerX: number;
  centerY: number;
}

interface StarRowProps {
  sequence: StarSequence;
  /** true → démarre la séquence. Tant que false, les pommes de pin nouvelles restent vides. */
  play: boolean;
  /** true → saute l'animation et affiche l'état final (tap du joueur). */
  skip?: boolean;
  /**
   * Appelé au pop de chaque pomme de pin NOUVELLE, avec sa position (pour lancer le vol vers le compteur).
   * `order` = rang parmi les nouvelles (0, 1, 2).
   */
  onStarPopped?: (slot: StarSlotLayout, order: number) => void;
  /** Appelé une fois : dernière pomme de pin nouvelle posée (et fête terminée), ou tout de suite s'il n'y en a pas. */
  onFinished?: () => void;
}

// ── Une pomme de pin ──────────────────────────────────────────────────────────

interface StarSlotProps {
  index: number;
  state: StarSlotState;
  delay: number;
  order: number;
  play: boolean;
  skip: boolean;
  reduceMotion: boolean;
  criterion: string;
  /** La couche dorée recouvre cet emplacement (transformation ou 3 déjà acquises). */
  hasGold: boolean;
  goldOpacity: SharedValue<number>;
  goldScale: SharedValue<number>;
  onPop: (index: number, order: number) => void;
}

function StarSlot({
  index, state, delay, order, play, skip, reduceMotion, criterion, hasGold, goldOpacity, goldScale, onPop,
}: StarSlotProps) {
  const isNew = state === 'new';
  // Les nouvelles partent du vide (échelle et opacité à 0 sur la couche « bois »).
  const scale = useSharedValue(isNew ? 0 : 1);
  const opacity = useSharedValue(isNew ? 0 : 1);
  const startedRef = useRef(false);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;

  // Position finale immédiate (tap pour passer, ou reprise).
  useEffect(() => {
    if (!isNew) return;
    if (skip && !startedRef.current) {
      startedRef.current = true;
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 1;
      opacity.value = 1;
      onPopRef.current(index, order);
    }
  }, [skip, isNew]);

  useEffect(() => {
    if (!isNew || !play || skip || startedRef.current) return;
    startedRef.current = true;
    const fire = () => onPopRef.current(index, order);
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }, (f) => {
        if (f) scheduleOnRN(fire);
      }));
    } else {
      // L'envol vers le compteur (son, vibration) part dès que la pomme de pin APPARAÎT, sans attendre le ressort.
      opacity.value = withDelay(delay, withTiming(1, { duration: 60 }, (f) => {
        if (f) scheduleOnRN(fire);
      }));
      scale.value = withDelay(
        delay,
        withSequence(
          withTiming(1.3, { duration: 110 }),
          withSpring(1, { damping: 10, stiffness: 300 }),
        ),
      );
    }
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [play, skip, isNew]);

  const woodStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const goldStyle = useAnimatedStyle(() => ({
    opacity: goldOpacity.value,
    transform: [{ scale: goldScale.value }],
  }));

  return (
    <View style={styles.slot}>
      <View style={styles.pineBox}>
        {/* Emplacement vide, toujours visible dessous */}
        <PineconeIcon size={PINE_H} variant="empty" opacity={0.85} />
        {state !== 'missed' && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, isNew ? woodStyle : null]}>
            <PineconeIcon size={PINE_H} variant="wood" />
          </Animated.View>
        )}
        {hasGold && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, goldStyle]}>
            <PineconeIcon size={PINE_H} variant="gold" />
          </Animated.View>
        )}
      </View>
      <Text style={[styles.criterion, state === 'missed' && styles.criterionMissed]}>
        {criterion}
      </Text>
    </View>
  );
}

// ── Rangée ────────────────────────────────────────────────────────────────────

export function StarRow({ sequence, play, skip = false, onStarPopped, onFinished }: StarRowProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const delays = getStarPopDelays(sequence);
  // Position (haut-gauche) et largeur de chaque emplacement, dans le repère de la rangée.
  const layouts = useRef<Record<number, { x: number; y: number; w: number }>>({});
  const rowLayout = useRef({ x: 0, y: 0 });
  const poppedRef = useRef(0);
  const finishedRef = useRef(false);
  const reportedRef = useRef(false);
  const skipRef = useRef(skip);
  skipRef.current = skip;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const transform = shouldTransform(sequence);
  const staticGold = isStaticGold(sequence);
  const hasGold = transform || staticGold;

  // Couche dorée commune aux trois emplacements : transparente tant que la transformation n'a pas eu lieu.
  const goldOpacity = useSharedValue(staticGold ? 1 : 0);
  const goldScale = useSharedValue(1);
  const [shots, setShots] = useState<BurstShot[]>([]);
  const shotKey = useRef(0);

  // Ordre des pommes de pin nouvelles (0, 1, 2…) par emplacement
  const orders: number[] = [];
  let k = 0;
  for (const s of sequence.slots) orders.push(s === 'new' ? k++ : -1);

  const report = useCallback(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onFinished?.();
  }, [onFinished]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /** État final immédiat de la couche dorée (tap pour passer). */
  const settleGold = useCallback(() => {
    cancelAnimation(goldOpacity);
    cancelAnimation(goldScale);
    goldOpacity.value = 1;
    goldScale.value = 1;
  }, [goldOpacity, goldScale]);

  /** La fête : trois bois → trois dorées, pulse de transformation, gerbes de confettis. */
  const startTransform = useCallback(() => {
    const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    later(PINECONE_TRANSFORM_DELAY_MS, () => {
      notificationSuccess();
      if (reduceMotion) {
        goldOpacity.value = withTiming(1, { duration: 200 });
      } else {
        goldOpacity.value = withTiming(1, { duration: PINECONE_TRANSFORM_DURATION_MS });
        goldScale.value = withSequence(
          withTiming(1.35, { duration: PINECONE_TRANSFORM_DURATION_MS * 0.55 }),
          withSpring(1, { damping: 7, stiffness: 260 }),
        );
        // Un tir par pomme de pin (centre d'abord, puis les côtés) : l'effet « bouquet final ».
        const centerY = PINE_H / 2;
        const xs = [1, 0, 2].map(i => {
          const l = layouts.current[i];
          return l ? l.x + l.w / 2 : 0;
        });
        setShots(xs.map((x, n) => ({
          key: ++shotKey.current, x, y: centerY, radius: n === 0 ? 110 : 85, count: n === 0 ? 28 : 20, delay: n * 90,
        })));
      }
    });
    later(PINECONE_TRANSFORM_DELAY_MS + PINECONE_CELEBRATION_MS, report);
  }, [reduceMotion, goldOpacity, goldScale, report]);

  const finishIfDone = useCallback(() => {
    if (finishedRef.current) return;
    if (poppedRef.current < sequence.newCount) return;
    finishedRef.current = true;
    if (!transform) { report(); return; }
    if (skipRef.current) { settleGold(); report(); return; }
    startTransform();
  }, [sequence.newCount, transform, report, settleGold, startTransform]);

  // Tap pendant la pause ou la fête : tout passe tout de suite à l'état final.
  useEffect(() => {
    if (!skip || !transform) return;
    clearTimers();
    settleGold();
    if (finishedRef.current) report();
  }, [skip, transform]);

  useEffect(() => clearTimers, []);

  // Aucune pomme de pin nouvelle : la séquence est « terminée » dès qu'elle démarre.
  useEffect(() => {
    if ((play || skip) && sequence.newCount === 0) finishIfDone();
  }, [play, skip, sequence.newCount]);

  const handlePop = useCallback((index: number, order: number) => {
    poppedRef.current += 1;
    // Son et vibration : une note de plus en plus aiguë par pomme de pin nouvelle.
    const rank = Math.min(order, STAR_NOTE_RATES.length - 1);
    playStarTone(rank);
    if (getStarHaptic(rank) === 'medium') impactMedium(); else impactLight();

    const l = layouts.current[index];
    if (l) {
      onStarPopped?.(
        {
          index,
          centerX: rowLayout.current.x + l.x + l.w / 2,
          // La pomme de pin occupe le haut de l'emplacement (le critère est dessous).
          centerY: rowLayout.current.y + l.y + PINE_H / 2,
        },
        order,
      );
    } else {
      onStarPopped?.({ index, centerX: 0, centerY: 0 }, order);
    }
    finishIfDone();
  }, [onStarPopped, finishIfDone]);

  const onRowLayout = (e: LayoutChangeEvent) => {
    rowLayout.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
  };

  const label =
    sequence.newCount > 0
      ? t('victory_stars_a11y', {
          earned: String(sequence.earnedStars),
          new: String(sequence.newCount),
          best: String(sequence.bestStars),
        })
      : t('victory_stars_a11y_none_new', {
          earned: String(sequence.earnedStars),
          best: String(sequence.bestStars),
        });

  return (
    <View
      style={styles.row}
      onLayout={onRowLayout}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      {sequence.slots.map((state, i) => (
        <View
          key={i}
          style={styles.slotWrapper}
          onLayout={(e) => {
            const { x, y, width } = e.nativeEvent.layout;
            layouts.current[i] = { x, y, w: width };
          }}
        >
          <StarSlot
            index={i}
            state={state}
            delay={delays[i]}
            order={orders[i]}
            play={play}
            skip={skip}
            reduceMotion={reduceMotion}
            criterion={t(STAR_CRITERIA_KEYS[i])}
            hasGold={hasGold}
            goldOpacity={goldOpacity}
            goldScale={goldScale}
            onPop={handlePop}
          />
        </View>
      ))}
      {/* Gerbes de confettis : au-dessus des trois pommes de pin, sans bloquer les taps */}
      <PineconeBurst shots={shots} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    // Les gerbes de confettis passent au-dessus de la jauge qui suit.
    zIndex: 10,
  },
  slotWrapper: { flex: 1, alignItems: 'center' },
  slot: { alignItems: 'center' },
  pineBox: {
    height: PINE_H,
    minWidth: PINE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { alignItems: 'center', justifyContent: 'center' },
  criterion: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#5D4037',
    textAlign: 'center',
  },
  criterionMissed: { color: '#9E9E9E', fontWeight: '600' },
});
