// ============================================================
// CEREMONYMODAL — cérémonie de fin de chapitre (Progression v2, C7 / Lot 4)
//
// Plein écran, Reanimated. Le joueur avance en TOUCHANT l'écran ; aucune étape n'impose plus de 2 s.
//   1. emblème : l'emblème du chapitre se remplit d'étoiles ;
//   2. rang    : le nouveau rang s'affiche et les graines volent vers le compteur ;
//   3. cartes  : récompenses face cachée, retournées d'un tap (mode, carte arbre, musique, région, trophée) ;
//   4. aperçu  : silhouettes des nouveaux éléments du chapitre suivant ;
//   5. actions : « Essayer maintenant » (vers le mode débloqué) et « Plus tard ».
//
// Toujours jouée APRÈS la VictoryModal, jamais pendant une partie (voir `useCeremonyPlayer`).
// « Réduire les animations » : fondus à la place des mouvements, mêmes étapes et mêmes textes.
// Les cartes-récompenses sont typées (`CeremonyCard`) : musique, carte arbre et région sont déjà
// présentées ici. Lot 7 : la carte d'arbre est désormais ATTRIBUÉE (grantChapterCards) ; la musique et le
// trophée le seront au Lot 8.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import {
  CeremonyCard,
  CeremonySummary,
  buildCeremonySummary,
  getCeremonyRank,
  getEmblemStarCount,
} from '../../constants/ceremonies';
import { getChapter, getRankLabel } from '../../constants/progression';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { getMusicForChapter } from '../../constants/musicUnlocks';
import { MUSIC_CATALOG } from '../../constants/music';
import { notificationSuccess, impactLight, impactMedium } from '../../utils/haptics';
import { playStarTone } from '../../services/starSoundService';
import { useT } from '../../i18n';
import { Confetti, useConfetti } from './Confetti';
import { RewardFly, useCounterPulse } from './RewardFly';
import { PineconeIcon } from './PineconeIcon';

const COLOR_GOLD = '#FFC107';
const BG = '#10230F';

export interface CeremonyModalProps {
  visible: boolean;
  /** Numéro du chapitre (1 à 7) dont on joue la cérémonie. */
  chapterId: number;
  language: string;
  /** Graines AVANT le versement (les graines de chapitre sont déjà versées au store) : départ du compteur. */
  seedsBefore: number;
  /** « Essayer maintenant » : le parent navigue vers le mode débloqué. */
  onTryNow: () => void;
  /** « Plus tard » ou fermeture : le parent marque la cérémonie vue. */
  onClose: () => void;
}

// ── Étape 1 : emblème qui se remplit de pommes de pin ───────────────────────────────

function EmblemStep({ chapterId, active, reduceMotion, t }: {
  chapterId: number; active: boolean; reduceMotion: boolean; t: (k: string, v?: Record<string, string>) => string;
}) {
  const chapter = getChapter(chapterId);
  const count = chapter ? getEmblemStarCount(chapter) : 3;
  const [filled, setFilled] = useState(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.6);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!active) return;
    scale.value = reduceMotion ? 1 : withSpring(1, { damping: 8, stiffness: 140 });
    opacity.value = withTiming(1, { duration: reduceMotion ? 150 : 350 });
    // Une étoile s'allume toutes les 350 ms (1,05 s pour 3 niveaux : < 2 s imposées)
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(setTimeout(() => {
        setFilled(i + 1);
        playStarTone(Math.min(i, 2));
        if (i >= 2) impactMedium(); else impactLight();
      }, reduceMotion ? i * 120 : 450 + i * 350));
    }
    return () => { timers.forEach(clearTimeout); cancelAnimation(scale); cancelAnimation(opacity); };
  }, [active]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  if (!chapter) return null;
  const name = t(chapter.nameKey);

  return (
    <View
      style={styles.stepCenter}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('ceremony_emblem_a11y', { n: String(chapterId), name, stars: String(count) })}
    >
      <Text style={styles.title}>{t('ceremony_title')}</Text>
      <Animated.View style={[styles.emblem, style]}>
        <Text style={styles.emblemEmoji}>{chapter.emoji}</Text>
      </Animated.View>
      <View style={styles.emblemStars}>
        {Array.from({ length: count }, (_, i) => (
          <PineconeIcon key={i} size={48} variant={i < filled ? 'gold' : 'empty'} opacity={i < filled ? 1 : 0.7} />
        ))}
      </View>
      <Text style={styles.chapterLabel}>{t('ceremony_chapter_label', { n: String(chapterId), name })}</Text>
    </View>
  );
}

// ── Étape 2 : nouveau rang + graines qui volent ──────────────────────────────

function RankStep({ summary, active, reduceMotion, language, seedsBefore, t }: {
  summary: CeremonySummary; active: boolean; reduceMotion: boolean; language: string; seedsBefore: number;
  t: (k: string, v?: Record<string, string>) => string;
}) {
  // Le rang annoncé est celui du chapitre SUIVANT (voir getCeremonyRank)
  const rank = getCeremonyRank(summary.chapterId);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.8);
  const { counterStyle, haloStyle, pulse } = useCounterPulse();
  const [displayed, setDisplayed] = useState(seedsBefore);
  const [gain, setGain] = useState(summary.seeds);
  const [fly, setFly] = useState(false);
  const arrived = useRef(0);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    opacity.value = withTiming(1, { duration: reduceMotion ? 150 : 300 });
    scale.value = reduceMotion ? 1 : withSpring(1, { damping: 9, stiffness: 160 });
    if (summary.seeds <= 0) return;
    const tm = setTimeout(() => setFly(true), reduceMotion ? 150 : 600);
    return () => { clearTimeout(tm); cancelAnimation(opacity); cancelAnimation(scale); };
  }, [active]);

  const onArrived = useCallback(() => {
    arrived.current += 1;
    setDisplayed(d => d + 1);
    setGain(g => Math.max(0, g - 1));
    pulse();
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  if (!rank) return null;
  const label = getRankLabel(rank, language);
  // Une graine animée par graine, plafonnée : 500 graines = 500 particules sinon.
  const particles = Math.min(12, Math.max(1, summary.seeds));
  const perParticle = summary.seeds / particles;

  return (
    <View style={styles.stepCenter}>
      <Animated.View
        style={[styles.rankBlock, style]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('ceremony_rank_a11y', { rank: label })}
      >
        <Text style={styles.sub}>{t('ceremony_new_rank')}</Text>
        <Text style={styles.rankEmoji}>{rank.emoji}</Text>
        <Text style={styles.rankName}>{label}</Text>
      </Animated.View>

      {summary.seeds > 0 && (
        <View
          style={styles.seedsRow}
          accessible
          accessibilityLabel={t('ceremony_seeds_gain_a11y', { count: String(summary.seeds) })}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.seedsSource} onLayout={(e: LayoutChangeEvent) => {
            const { x, y, width, height } = e.nativeEvent.layout;
            setOrigin({ x: x + width / 2, y: y + height / 2 });
          }}>
            <Text style={styles.seedsGain}>{gain > 0 ? t('ceremony_seeds_gain', { count: String(Math.round(gain)) }) : '✓'}</Text>
          </View>
          <View style={styles.seedsTargetWrap} onLayout={(e: LayoutChangeEvent) => {
            const { x, y, width, height } = e.nativeEvent.layout;
            setTarget({ x: x + width / 2, y: y + height / 2 });
          }}>
            <Animated.View style={[styles.seedsHalo, haloStyle]} pointerEvents="none" />
            <Animated.View style={[styles.seedsCounter, counterStyle]}>
              <Text style={styles.seedsCounterText}>🌱 {Math.round(displayed)}</Text>
            </Animated.View>
          </View>
          {fly && origin && target && (
            <RewardFly
              target="seeds"
              count={particles}
              fromX={origin.x}
              fromY={origin.y}
              targetX={target.x}
              targetY={target.y}
              onArrived={() => {
                // Chaque particule vaut `perParticle` graines : le total affiché atteint exactement `summary.seeds`
                setDisplayed(d => d + perParticle - 1);
                setGain(g => Math.max(0, g - perParticle + 1));
                onArrived();
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── Étape 3 : cartes face cachée ─────────────────────────────────────────────

function FlipCard({ card, revealed, onFlip, reduceMotion, t }: {
  card: CeremonyCard; revealed: boolean; onFlip: () => void; reduceMotion: boolean;
  t: (k: string, v?: Record<string, string>) => string;
}) {
  const flip = useSharedValue(revealed ? 1 : 0);
  useEffect(() => {
    flip.value = reduceMotion
      ? withTiming(revealed ? 1 : 0, { duration: 150 })
      : withTiming(revealed ? 1 : 0, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [revealed]);

  const back = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 - flip.value : (flip.value < 0.5 ? 1 : 0),
    transform: reduceMotion ? [] : [{ perspective: 600 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const front = useAnimatedStyle(() => ({
    opacity: reduceMotion ? flip.value : (flip.value >= 0.5 ? 1 : 0),
    transform: reduceMotion ? [] : [{ perspective: 600 }, { rotateY: `${interpolate(flip.value, [0, 1], [-180, 0])}deg` }],
  }));

  // Carte « musique » : nomme le titre réellement offert (Lot 8) ; le trophée final porte son nom.
  const trackId = card.kind === 'music' ? getMusicForChapter(card.chapter) : null;
  const trackTitle = trackId ? MUSIC_CATALOG.find(m => m.id === trackId)?.title : undefined;
  const title = trackTitle ?? (card.kind === 'trophy' ? t('trophy_final_name') : t(card.titleKey));
  const legendary = card.kind === 'tree_card' && card.legendary;
  return (
    <Pressable
      onPress={() => { if (!revealed) { onFlip(); impactMedium(); } }}
      disabled={revealed}
      style={styles.cardWrap}
      accessibilityRole="button"
      accessibilityLabel={revealed ? t('ceremony_card_revealed_a11y', { title }) : t('ceremony_card_hidden_a11y')}
      accessibilityState={{ disabled: revealed }}
    >
      <Animated.View style={[styles.card, styles.cardBack, back]}>
        <Text style={styles.cardBackMark}>?</Text>
      </Animated.View>
      <Animated.View style={[styles.card, styles.cardFront, legendary && styles.cardLegendary, front]} pointerEvents="none">
        <Text style={styles.cardEmoji}>{card.emoji}</Text>
        <Text style={styles.cardTitle} numberOfLines={3}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

function CardsStep({ cards, revealed, onFlip, reduceMotion, t }: {
  cards: CeremonyCard[]; revealed: boolean[]; onFlip: (i: number) => void; reduceMotion: boolean;
  t: (k: string, v?: Record<string, string>) => string;
}) {
  return (
    <View style={styles.stepCenter}>
      <Text style={styles.title}>{t('ceremony_cards_title')}</Text>
      <Text style={styles.hint}>{t('ceremony_cards_hint')}</Text>
      <View style={styles.cardsGrid}>
        {cards.map((c, i) => (
          <FlipCard key={i} card={c} revealed={!!revealed[i]} onFlip={() => onFlip(i)} reduceMotion={reduceMotion} t={t} />
        ))}
      </View>
    </View>
  );
}

// ── Étape 4 : aperçu du chapitre suivant (silhouettes) ───────────────────────

function PreviewStep({ summary, active, reduceMotion, t }: {
  summary: CeremonySummary; active: boolean; reduceMotion: boolean; t: (k: string, v?: Record<string, string>) => string;
}) {
  const preview = summary.preview;
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (active) opacity.value = withTiming(1, { duration: reduceMotion ? 150 : 400 });
  }, [active]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!preview) return null;
  const next = getChapter(preview.chapterId);

  return (
    <Animated.View
      style={[styles.stepCenter, style]}
      accessible
      accessibilityLabel={t('ceremony_preview_a11y', { n: String(preview.chapterId) })}
    >
      <Text style={styles.title}>{t('ceremony_preview_title')}</Text>
      {next && (
        <Text style={styles.chapterLabel}>
          {next.emoji} {t('ceremony_chapter_label', { n: String(next.id), name: t(next.nameKey) })}
        </Text>
      )}
      {preview.newElementIds.length > 0 ? (
        <View style={styles.silhouettes}>
          {preview.newElementIds.map(id => {
            const def = ElementRegistry[id];
            if (!def) return null;
            return (
              <View key={id} style={styles.silhouette}>
                {/* Silhouette : l'icône est assombrie, le nom n'est pas révélé (découverte au niveau) */}
                <Image
                  source={typeof def.icon === 'string' ? { uri: def.icon } : def.icon}
                  style={styles.silhouetteImg}
                  resizeMode="contain"
                  tintColor="#000"
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={styles.silhouetteMark}>?</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.hint}>{t('ceremony_preview_none')}</Text>
      )}
    </Animated.View>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export const CeremonyModal: React.FC<CeremonyModalProps> = ({
  visible, chapterId, language, seedsBefore, onTryNow, onClose,
}) => {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const summary = useMemo(() => buildCeremonySummary(chapterId), [chapterId]);
  const steps = summary?.steps ?? [];
  const confettiPieces = useConfetti(visible);

  const [stepIndex, setStepIndex] = useState(0);
  const [canAdvance, setCanAdvance] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const backdrop = useSharedValue(0);

  // Réinitialisation à chaque ouverture
  useEffect(() => {
    if (!visible) { backdrop.value = 0; return; }
    setStepIndex(0);
    setRevealed(new Array(summary?.cards.length ?? 0).fill(false));
    backdrop.value = withTiming(1, { duration: reduceMotion ? 120 : 300 });
    notificationSuccess();
    AccessibilityInfo.announceForAccessibility(
      t('ceremony_title') + ' ' + t('ceremony_chapter_label', {
        n: String(chapterId), name: summary ? t(getChapter(chapterId)?.nameKey ?? '') : '',
      }),
    );
  }, [visible, chapterId]);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;
  const allRevealed = revealed.length > 0 && revealed.every(Boolean);

  // Délai « imposé » de l'étape (≤ 2 s, voir CEREMONY_MAX_FORCED_MS) avant de pouvoir avancer
  useEffect(() => {
    if (!visible || !step) return;
    setCanAdvance(false);
    const ms = reduceMotion ? Math.min(step.forcedMs, 300) : step.forcedMs;
    if (ms <= 0) { setCanAdvance(true); return; }
    const tm = setTimeout(() => setCanAdvance(true), ms);
    return () => clearTimeout(tm);
  }, [visible, stepIndex]);

  const advance = useCallback(() => {
    if (!step || !canAdvance || isLast) return;
    // Étape des cartes : on avance une fois toutes les cartes retournées (le tap retourne la carte, pas l'étape)
    if (step.id === 'cards' && !allRevealed) return;
    setStepIndex(i => Math.min(i + 1, steps.length - 1));
  }, [step, canAdvance, isLast, allRevealed, steps.length]);

  const onFlip = useCallback((i: number) => {
    setRevealed(prev => prev.map((v, idx) => (idx === i ? true : v)));
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  if (!summary || !step) return null;

  const showNext = !isLast && canAdvance && (step.id !== 'cards' || allRevealed);
  const tryNow = summary.tryNow !== '/(tabs)/';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        {/* Toute la surface est tactile : un tap avance (sauf sur les cartes et les boutons) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={advance}
          accessibilityRole="button"
          accessibilityLabel={t('ceremony_tap_hint')}
          disabled={isLast}
        />

        <View style={styles.content} pointerEvents="box-none">
          {step.id === 'emblem' && <EmblemStep chapterId={chapterId} active={visible} reduceMotion={reduceMotion} t={t} />}
          {step.id === 'rank' && (
            <RankStep summary={summary} active={visible} reduceMotion={reduceMotion} language={language} seedsBefore={seedsBefore} t={t} />
          )}
          {step.id === 'cards' && (
            <CardsStep cards={summary.cards} revealed={revealed} onFlip={onFlip} reduceMotion={reduceMotion} t={t} />
          )}
          {step.id === 'preview' && <PreviewStep summary={summary} active={visible} reduceMotion={reduceMotion} t={t} />}
          {step.id === 'actions' && (
            <View style={styles.stepCenter}>
              <Text style={styles.emblemEmoji}>{getChapter(chapterId)?.emoji}</Text>
              <Text style={styles.title}>{t('ceremony_title')}</Text>
            </View>
          )}
        </View>

        {/* Pied : indication de tap, ou boutons d'action à la dernière étape */}
        <View style={styles.footer} pointerEvents="box-none">
          {isLast ? (
            <View style={styles.actions}>
              {tryNow && (
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={onTryNow}
                  accessibilityRole="button"
                  accessibilityLabel={t('ceremony_try_now')}
                >
                  <Text style={styles.btnPrimaryText}>{t('ceremony_try_now')}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.btn, tryNow ? styles.btnSecondary : styles.btnPrimary]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={tryNow ? t('ceremony_later') : t('ceremony_next')}
              >
                <Text style={tryNow ? styles.btnSecondaryText : styles.btnPrimaryText}>
                  {tryNow ? t('ceremony_later') : t('ceremony_next')}
                </Text>
              </Pressable>
            </View>
          ) : (
            showNext && (
              <Pressable onPress={advance} accessibilityRole="button" accessibilityLabel={t('ceremony_tap_hint')}>
                <Text style={styles.tapHint}>{t('ceremony_tap_hint')}</Text>
              </Pressable>
            )
          )}
          {/* Progression : un point par étape */}
          <View style={styles.dots} accessible={false} importantForAccessibility="no-hide-descendants">
            {steps.map((s, i) => (
              <View key={s.id} style={[styles.dot, i === stepIndex && styles.dotActive, i < stepIndex && styles.dotDone]} />
            ))}
          </View>
        </View>
      </Animated.View>
      <Confetti pieces={step.id === 'emblem' || step.id === 'rank' ? confettiPieces ?? null : null} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: BG },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 48 },
  stepCenter: { alignItems: 'center', gap: 14 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFF8E7', textAlign: 'center' },
  sub: { fontSize: 14, fontWeight: '700', color: COLOR_GOLD, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontSize: 13, color: 'rgba(255,248,231,0.7)', textAlign: 'center' },
  chapterLabel: { fontSize: 16, fontWeight: '700', color: 'rgba(255,248,231,0.85)', textAlign: 'center' },

  emblem: {
    width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,193,7,0.14)',
    borderWidth: 3, borderColor: COLOR_GOLD, alignItems: 'center', justifyContent: 'center', marginVertical: 8,
  },
  emblemEmoji: { fontSize: 72 },
  emblemStars: { flexDirection: 'row', gap: 10 },

  rankBlock: { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 24 },
  rankEmoji: { fontSize: 64 },
  rankName: { fontSize: 30, fontWeight: '900', color: '#FFF8E7', textAlign: 'center' },
  seedsRow: { alignItems: 'center', gap: 18, marginTop: 16, width: '100%' },
  seedsSource: { paddingVertical: 4, paddingHorizontal: 14 },
  seedsGain: { fontSize: 26, fontWeight: '900', color: '#9CCC65' },
  seedsTargetWrap: { alignItems: 'center', justifyContent: 'center' },
  seedsHalo: { position: 'absolute', width: 120, height: 52, borderRadius: 26, backgroundColor: '#6FCF5A' },
  seedsCounter: {
    backgroundColor: Colors.forest.dark, borderRadius: 22, paddingVertical: 8, paddingHorizontal: 20,
    borderWidth: 2, borderColor: '#6FCF5A',
  },
  seedsCounterText: { fontSize: 24, fontWeight: '800', color: '#FFF8E7' },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 },
  cardWrap: { width: 96, height: 128 },
  card: {
    position: 'absolute', width: 96, height: 128, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', padding: 6, backfaceVisibility: 'hidden',
  },
  cardBack: { backgroundColor: '#2E5A2E', borderWidth: 2, borderColor: COLOR_GOLD },
  cardBackMark: { fontSize: 40, fontWeight: '900', color: COLOR_GOLD },
  cardFront: { backgroundColor: '#FFF8E7', borderWidth: 2, borderColor: '#8BC34A' },
  cardLegendary: { borderColor: COLOR_GOLD, backgroundColor: '#FFF3C4' },
  cardEmoji: { fontSize: 34, marginBottom: 4 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: Colors.forest.dark, textAlign: 'center' },

  silhouettes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 6 },
  silhouette: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  silhouetteImg: { width: 52, height: 52, opacity: 0.85 },
  silhouetteMark: { position: 'absolute', fontSize: 22, fontWeight: '900', color: COLOR_GOLD },

  footer: { paddingHorizontal: 24, paddingBottom: 36, alignItems: 'center', gap: 16 },
  tapHint: { fontSize: 14, fontWeight: '700', color: 'rgba(255,248,231,0.85)' },
  actions: { width: '100%', gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%' },
  btnPrimary: { backgroundColor: Colors.forest.medium },
  btnPrimaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,248,231,0.4)' },
  btnSecondaryText: { color: 'rgba(255,248,231,0.9)', fontSize: 15, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: COLOR_GOLD, width: 20 },
  dotDone: { backgroundColor: 'rgba(255,193,7,0.55)' },
});
