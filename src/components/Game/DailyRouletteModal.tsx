// ============================================================
// DAILYROULETTEMODAL — Bandit manchot forestier
// Affiché après la victoire du Défi du Jour.
// 3 rouleaux animés + jackpot global Firestore.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { usePlayerStore } from '../../store/playerStore';
import { SeedFlyAnimation, useCounterPulse } from './SeedFlyAnimation';
import { useConfetti, Confetti } from './Confetti';
import { auth } from '../../services/firebase';
import {
  subscribeJackpot,
  claimJackpot,
  hasAlreadyClaimed,
  JackpotData,
} from '../../services/jackpotService';

// Compte de test — peut toujours rejouer la roulette
const DEV_USERNAMES = ['Ramoni'];

const native = Platform.OS !== 'web';

// ── Éléments disponibles sur les rouleaux ─────────────────────────────────────
// Exclus : chien (connected_group), champignon (center_only)

const REEL_ELEMENTS: Array<{ id: string; image: any; label: string }> = [
  { id: 'bucheron',  image: require('../../../assets/elements/pastilles/bucheron.png'),  label: 'Bûcheron'  },
  { id: 'ours',      image: require('../../../assets/elements/pastilles/ours.png'),      label: 'Ours'      },
  { id: 'mouton',    image: require('../../../assets/elements/pastilles/mouton.png'),    label: 'Mouton'    },
  { id: 'chalet',    image: require('../../../assets/elements/pastilles/chalet.png'),    label: 'Chalet'    },
  { id: 'loup',      image: require('../../../assets/elements/pastilles/loup.png'),      label: 'Loup'      },
  { id: 'ruche',     image: require('../../../assets/elements/pastilles/ruche.png'),     label: 'Ruche'     },
  { id: 'cerf',      image: require('../../../assets/elements/pastilles/cerf.png'),      label: 'Cerf'      },
  { id: 'biche',     image: require('../../../assets/elements/pastilles/biche.png'),     label: 'Biche'     },
  { id: 'tas_buches',image: require('../../../assets/elements/pastilles/tas_buches.png'),label: 'Bûches'    },
  { id: 'arbre',     image: require('../../../assets/elements/pastilles/arbre.png'),     label: 'Arbre'     },
];

const N = REEL_ELEMENTS.length; // 10

// ── Table des gains ───────────────────────────────────────────────────────────

const ELEMENT_RARITY: Record<string, { pair: number; triple: number }> = {
  bucheron:  { pair: 10,  triple: 50  },
  mouton:    { pair: 10,  triple: 50  },
  ours:      { pair: 15,  triple: 75  },
  loup:      { pair: 15,  triple: 75  },
  biche:     { pair: 15,  triple: 75  },
  cerf:      { pair: 20,  triple: 100 },
  chalet:    { pair: 20,  triple: 100 },
  tas_buches:{ pair: 25,  triple: 125 },
  ruche:     { pair: 30,  triple: 150 },
  arbre:     { pair: 0,   triple: 0   }, // jackpot uniquement
};

// ── Seed PRNG déterministe ────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0xFFFFFFFF;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export type RouletteResult =
  | { type: 'nothing' }
  | { type: 'pair';    elementId: string; gain: number }
  | { type: 'triple';  elementId: string; gain: number }
  | { type: 'jackpot'; gain: number };

function computeResult(seed: number, jackpotAmount: number): {
  reels: [number, number, number]; // index dans REEL_ELEMENTS
  result: RouletteResult;
} {
  const rand = mulberry32(seed);
  const r = rand();

  // Probabilités : jackpot 10% | triple 15% | paire 30% | rien 45%
  let reels: [number, number, number];
  let result: RouletteResult;

  if (r < 0.10) {
    // Jackpot : 3 arbres
    const arbreIdx = REEL_ELEMENTS.findIndex(e => e.id === 'arbre');
    reels = [arbreIdx, arbreIdx, arbreIdx];
    result = { type: 'jackpot', gain: jackpotAmount };
  } else if (r < 0.25) {
    // Triple non-jackpot : choisir un élément aléatoire sauf arbre
    const nonArbre = REEL_ELEMENTS.filter(e => e.id !== 'arbre');
    const chosen = nonArbre[Math.floor(rand() * nonArbre.length)];
    const idx = REEL_ELEMENTS.indexOf(chosen);
    reels = [idx, idx, idx];
    result = { type: 'triple', elementId: chosen.id, gain: ELEMENT_RARITY[chosen.id]?.triple ?? 50 };
  } else if (r < 0.55) {
    // Paire : rouleau 0 et 1 identiques, rouleau 2 différent
    const nonArbre = REEL_ELEMENTS.filter(e => e.id !== 'arbre');
    const chosen = nonArbre[Math.floor(rand() * nonArbre.length)];
    const idx = REEL_ELEMENTS.indexOf(chosen);
    // Troisième rouleau : différent
    let idx2 = Math.floor(rand() * N);
    while (idx2 === idx) idx2 = Math.floor(rand() * N);
    reels = [idx, idx, idx2];
    result = { type: 'pair', elementId: chosen.id, gain: ELEMENT_RARITY[chosen.id]?.pair ?? 10 };
  } else {
    // Rien : 3 rouleaux tous différents
    const i0 = Math.floor(rand() * N);
    let i1 = Math.floor(rand() * N);
    while (i1 === i0) i1 = Math.floor(rand() * N);
    let i2 = Math.floor(rand() * N);
    while (i2 === i0 || i2 === i1) i2 = Math.floor(rand() * N);
    reels = [i0, i1, i2];
    result = { type: 'nothing' };
  }

  return { reels, result };
}

// ── Hauteur d'une case de rouleau ─────────────────────────────────────────────

const CELL_H = 72;
const VISIBLE_CELLS = 3; // nombre de cellules visibles par rouleau
const REEL_H = CELL_H * VISIBLE_CELLS;
// Répétitions de la liste pour donner l'illusion de défilement infini
const REPEATS = 8;

// ── Composant Reel ────────────────────────────────────────────────────────────

interface ReelProps {
  targetIndex: number; // index dans REEL_ELEMENTS du résultat
  spinning: boolean;
  stopDelay: number; // ms avant que ce rouleau s'arrête
  onStop: () => void;
}

const Reel: React.FC<ReelProps> = ({ targetIndex, spinning, stopDelay, onStop }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const scrollRef  = useRef<ScrollView>(null);

  // Total items dans la liste répétée
  const totalItems = N * REPEATS;
  // Position de l'élément cible : on vise la répétition centrale (REPEATS/2)
  const targetCentral = Math.floor(REPEATS / 2) * N + targetIndex;
  // Y pour que targetCentral soit au centre (1er de 3 visibles = index 1 dans la fenêtre)
  const targetY = (targetCentral - 1) * CELL_H;

  useEffect(() => {
    if (!spinning) return;

    // Partir d'un scroll rapide, puis ralentir et s'arrêter sur la cible
    const startY = 0;
    // Y de spin intermédiaire (plusieurs tours)
    const spinY = Math.floor(REPEATS / 4) * N * CELL_H;

    // Phase 1 : spin rapide jusqu'à spinY
    // Phase 2 : décélération vers targetY
    Animated.sequence([
      Animated.timing(scrollAnim, {
        toValue: spinY,
        duration: stopDelay * 0.55,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(scrollAnim, {
        toValue: targetY,
        duration: stopDelay * 0.45,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      onStop();
    });
  }, [spinning]);

  // Synchroniser scrollAnim avec le ScrollView
  useEffect(() => {
    const id = scrollAnim.addListener(({ value }) => {
      scrollRef.current?.scrollTo({ y: value, animated: false });
    });
    return () => scrollAnim.removeListener(id);
  }, []);

  const items = Array.from({ length: totalItems }, (_, i) => REEL_ELEMENTS[i % N]);

  return (
    <View style={reelStyles.reelContainer}>
      {/* Gradient haut */}
      <View style={[reelStyles.gradient, reelStyles.gradientTop]} pointerEvents="none" />
      {/* Ligne centrale */}
      <View style={reelStyles.centerLine} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={reelStyles.scroll}
      >
        {items.map((el, i) => (
          <View key={i} style={reelStyles.cell}>
            <Image source={el.image} style={reelStyles.cellImage} resizeMode="contain" />
          </View>
        ))}
      </ScrollView>
      {/* Gradient bas */}
      <View style={[reelStyles.gradient, reelStyles.gradientBottom]} pointerEvents="none" />
    </View>
  );
};

const reelStyles = StyleSheet.create({
  reelContainer: {
    width: 72,
    height: REEL_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.forest.dark + '22',
    borderWidth: 2,
    borderColor: Colors.forest.medium + '55',
  },
  scroll: {
    flex: 1,
  },
  cell: {
    width: 72,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellImage: {
    width: 52,
    height: 52,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CELL_H,
    zIndex: 2,
  },
  gradientTop: {
    top: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  gradientBottom: {
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  centerLine: {
    position: 'absolute',
    top: CELL_H,
    left: 4,
    right: 4,
    height: CELL_H,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFD700',
    zIndex: 3,
  },
});

// ── Modal principal ───────────────────────────────────────────────────────────

interface DailyRouletteModalProps {
  visible: boolean;
  onClose: () => void;
  uid: string;
  date: string;
}

type Phase = 'idle' | 'spinning' | 'result';

export const DailyRouletteModal: React.FC<DailyRouletteModalProps> = ({
  visible, onClose, uid, date,
}) => {
  const player = usePlayerStore();
  const totalSeeds = usePlayerStore(s => s.seeds);

  const [phase,        setPhase]       = useState<Phase>('idle');
  const [jackpot,      setJackpot]     = useState<JackpotData | null>(null);
  const [reelTargets,  setReelTargets] = useState<[number, number, number]>([0, 0, 0]);
  const [result,       setResult]      = useState<RouletteResult | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [stoppedCount, setStoppedCount]   = useState(0);
  const [showTable,    setShowTable]   = useState(false);
  const [isJackpotWin, setIsJackpotWin] = useState(false);

  const isDevAccount = DEV_USERNAMES.includes(auth.currentUser?.displayName ?? '');

  // Confetti jackpot
  const confettiPieces = useConfetti(isJackpotWin);
  // Animation flash doré jackpot
  const jackpotFlash = useRef(new Animated.Value(0)).current;

  // ── Compteur de graines (comme VictoryModal) ──────────────────────────────
  const [seedsBeforeGain,  setSeedsBeforeGain]  = useState(0);
  const [gainAmount,       setGainAmount]        = useState(0);
  const [displayedSeeds,   setDisplayedSeeds]    = useState(totalSeeds);
  const [displayedGain,    setDisplayedGain]     = useState(0);
  const [flyActive,        setFlyActive]         = useState(false);
  const [flyKey,           setFlyKey]            = useState(0);
  const arrivedCount  = useRef(0);
  const launchedCount = useRef(0);

  // Positions mesurées via onLayout (référentiel carte)
  const [counterY,  setCounterY]  = useState<number | null>(null);
  const [counterX,  setCounterX]  = useState(150);
  const [fromY,     setFromY]     = useState<number | null>(null);
  const [fromX,     setFromX]     = useState(188);

  const onCounterLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setCounterY(y + height / 2);
    setCounterX(x + width / 2);
  }, []);
  const onReelsLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setFromY(y + height / 2);
    setFromX(x + width / 2);
  }, []);

  const { scale: counterScale, haloOpacity, haloScale, pulse } = useCounterPulse();

  // Animations : scale de la carte + résultat
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const resultAnim  = useRef(new Animated.Value(0)).current;

  // ── Abonnement jackpot ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const unsub = subscribeJackpot(data => setJackpot(data));
    return () => unsub();
  }, [visible]);

  // ── Animation entrée ───────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      setPhase('idle');
      setResult(null);
      setStoppedCount(0);
      setAlreadyPlayed(false);
      setFlyActive(false);
      setGainAmount(0);
      setDisplayedGain(0);
      arrivedCount.current  = 0;
      launchedCount.current = 0;
      // Initialiser le compteur au total actuel (pas encore de gain)
      const currentSeeds = usePlayerStore.getState().seeds;
      setSeedsBeforeGain(currentSeeds);
      setDisplayedSeeds(currentSeeds);

      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: native }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: native }),
      ]).start();

      // Vérifier si déjà joué aujourd'hui (bypass pour comptes de test)
      if (uid && !isDevAccount) {
        hasAlreadyClaimed(uid, date).then(claimed => {
          setAlreadyPlayed(claimed);
        }).catch(() => {});
      }
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // ── Quand tous les rouleaux sont arrêtés → afficher le résultat ─────────────
  useEffect(() => {
    if (stoppedCount < 3 || phase !== 'spinning') return;
    setPhase('result');
    Animated.spring(resultAnim, { toValue: 1, damping: 10, stiffness: 180, useNativeDriver: native }).start();
    // Jackpot : confetti + flash doré
    if (result?.type === 'jackpot') {
      setIsJackpotWin(true);
      jackpotFlash.setValue(0);
      Animated.sequence([
        Animated.timing(jackpotFlash, { toValue: 1, duration: 200, useNativeDriver: native }),
        Animated.timing(jackpotFlash, { toValue: 0, duration: 300, useNativeDriver: native }),
        Animated.timing(jackpotFlash, { toValue: 0.7, duration: 150, useNativeDriver: native }),
        Animated.timing(jackpotFlash, { toValue: 0, duration: 400, useNativeDriver: native }),
      ]).start();
    }
  }, [stoppedCount, phase]);

  // ── Déclencher l'aspiration dès que gain connu ET résultat affiché ────────────
  // (gainAmount mis à jour dans handleSpin, phase passe à 'result' dans l'effet ci-dessus)
  useEffect(() => {
    if (gainAmount <= 0 || phase !== 'result' || flyActive) return;
    const count = Math.min(gainAmount, 20); // max 20 particules visuelles
    const t = setTimeout(() => {
      launchedCount.current = count;
      arrivedCount.current  = 0;
      setDisplayedGain(gainAmount);
      setFlyKey(k => k + 1);
      setFlyActive(true);
    }, 500); // délai pour laisser l'animation du résultat démarrer
    return () => clearTimeout(t);
  }, [gainAmount, phase]);

  // ── Lancer la roulette ─────────────────────────────────────────────────────
  const handleSpin = useCallback(async () => {
    if (phase !== 'idle' || alreadyPlayed || !uid) return;

    const seed = isDevAccount ? Date.now() : hashString(uid + date);
    const jackpotAmount = jackpot?.amount ?? 200;
    const { reels, result: computedResult } = computeResult(seed, jackpotAmount);

    setReelTargets(reels);
    setResult(computedResult);
    setStoppedCount(0);
    resultAnim.setValue(0);
    setPhase('spinning');

    // Réclamer côté Firestore (anti-triche : avant d'afficher le gain)
    const isJackpotResult = computedResult.type === 'jackpot';
    const localGain       = computedResult.type !== 'nothing' && computedResult.type !== 'jackpot'
      ? computedResult.gain
      : 0;

    // Capturer les graines avant le gain
    const seedsBefore = usePlayerStore.getState().seeds;
    setSeedsBeforeGain(seedsBefore);

    if (isDevAccount) {
      // Mode test : on écrit quand même Firestore pour le jackpot (remise à 200 réelle),
      // mais on ignore alreadyClaimed pour pouvoir rejouer.
      if (isJackpotResult) {
        // Appel réel pour remettre la cagnotte à 200 en base
        const claimed = await claimJackpot(uid, date + '_dev_' + Date.now(), isJackpotResult, 0);
        const gain = claimed.gain > 0 ? claimed.gain : jackpotAmount;
        player.addSeeds(gain);
        setGainAmount(gain);
        setResult(prev => prev ? { ...prev, gain } as RouletteResult : prev);
      } else {
        const gain = localGain;
        if (gain > 0) {
          player.addSeeds(gain);
          setGainAmount(gain);
        }
      }
      return;
    }

    const claimed = await claimJackpot(uid, date, isJackpotResult, localGain);
    // Corriger le gain si transaction a renvoyé un gain différent (ex: jackpot race condition)
    if (claimed.alreadyClaimed) {
      setAlreadyPlayed(true);
      setPhase('idle');
      return;
    }
    // Ajouter les graines localement (le vrai montant issu de la transaction)
    if (claimed.gain > 0) {
      player.addSeeds(claimed.gain);
      setGainAmount(claimed.gain);
    }
    // Si le gain local calculé diffère (ex: offline fallback), ajuster le résultat affiché
    if (claimed.gain !== (computedResult as any).gain && computedResult.type !== 'nothing') {
      setResult(prev => prev ? { ...prev, gain: claimed.gain } as RouletteResult : prev);
    }
  }, [phase, alreadyPlayed, uid, date, jackpot, player]);

  const handleReelStop = useCallback(() => {
    setStoppedCount(prev => prev + 1);
  }, []);

  const onSeedArrived = useCallback(() => {
    arrivedCount.current += 1;
    setDisplayedSeeds(prev => prev + 1);
    setDisplayedGain(prev => Math.max(0, prev - 1));
    pulse();
  }, [pulse]);

  // ── Affichage du résultat ──────────────────────────────────────────────────
  const resultText = useMemo(() => {
    if (!result) return '';
    if (result.type === 'nothing') return 'Pas de chance...';
    if (result.type === 'jackpot') return `JACKPOT ! +${result.gain} graines !`;
    return `+${result.gain} graines !`;
  }, [result]);

  const resultColor = useMemo(() => {
    if (!result) return Colors.forest.dark;
    if (result.type === 'jackpot') return '#FFD700';
    if (result.type === 'triple')  return Colors.forest.medium;
    if (result.type === 'pair')    return Colors.forest.light;
    return Colors.ui.textLight;
  }, [result]);

  // ── Table des gains (modal inline) ────────────────────────────────────────
  // Structurée en sections : jackpot / triple / paire / rien
  const jackpotAmount = jackpot?.amount ?? 200;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* ── Compteur de graines (cible des animations) ──────────────── */}
          <View style={styles.counterWrapper} onLayout={onCounterLayout}>
            <Animated.View
              style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
              pointerEvents="none"
            />
            <Animated.View style={[styles.seedCounterBadge, { transform: [{ scale: counterScale }] }]}>
              <Text style={styles.seedCounterValue}>{displayedSeeds}</Text>
              <Text style={styles.seedCounterEmoji}>🌱</Text>
              {displayedGain > 0 && (
                <View style={styles.seedGainBubble}>
                  <Text style={styles.seedGainText}>+{displayedGain}</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* ── Titre ──────────────────────────────────────────────────── */}
          <Text style={styles.title}>Tente ta chance !</Text>

          {/* ── Jackpot ─────────────────────────────────────────────────── */}
          <View style={styles.jackpotBanner}>
            <Text style={styles.jackpotTree}>{'🌳'}</Text>
            <View>
              <Text style={styles.jackpotLabel}>Jackpot</Text>
              <Text style={styles.jackpotAmount}>{jackpot?.amount ?? '…'} graines</Text>
            </View>
            <TouchableOpacity
              style={styles.tableBtn}
              onPress={() => setShowTable(s => !s)}
              activeOpacity={0.7}
            >
              <Text style={styles.tableBtnText}>?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Mini-modale table des gains ──────────────────────────────── */}
          <Modal visible={showTable} transparent animationType="fade" statusBarTranslucent>
            <TouchableOpacity
              style={styles.tableBackdrop}
              activeOpacity={1}
              onPress={() => setShowTable(false)}
            >
              <TouchableOpacity activeOpacity={1} style={styles.tableCard}>
                <Text style={styles.tableTitle}>TABLE DES GAINS</Text>

                {/* Jackpot */}
                <View style={styles.tableSection}>
                  <View style={[styles.tableRow, styles.tableRowJackpot]}>
                    <View style={styles.tableRowLeft}>
                      <Text style={styles.tableRowEmoji}>🌳🌳🌳</Text>
                      <Text style={styles.tableRowLabelJackpot}>3 Arbres = JACKPOT</Text>
                    </View>
                    <Text style={styles.tableRowValueJackpot}>+{jackpotAmount} graines</Text>
                  </View>
                  <Text style={styles.tableNote}>
                    Le jackpot grandit de 50 graines chaque jour et repart à 200 quand il est remporté.
                  </Text>
                </View>

                {/* Triple */}
                <View style={styles.tableSection}>
                  <View style={styles.tableSectionHeader}>
                    <Text style={styles.tableSectionEmoji}>🎯🎯🎯</Text>
                    <Text style={styles.tableSectionTitle}>3 symboles identiques</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableRowLabel}>Légendaire (ruche)</Text>
                    <Text style={styles.tableRowValue}>+150 graines</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableRowLabel}>Épique (cerf, chalet, bûches)</Text>
                    <Text style={styles.tableRowValue}>+100-125 graines</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableRowLabel}>Rare (ours, loup, biche…)</Text>
                    <Text style={styles.tableRowValue}>+75 graines</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableRowLabel}>Commun (bûcheron, mouton…)</Text>
                    <Text style={styles.tableRowValue}>+50 graines</Text>
                  </View>
                </View>

                {/* Paire */}
                <View style={styles.tableSection}>
                  <View style={styles.tableSectionHeader}>
                    <Text style={styles.tableSectionEmoji}>🎯🎯</Text>
                    <Text style={styles.tableSectionTitle}>2 symboles identiques</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableRowLabel}>Selon la rareté</Text>
                    <Text style={styles.tableRowValue}>+10 à +30 graines</Text>
                  </View>
                </View>

                {/* Rien */}
                <View style={[styles.tableRow, { marginTop: 4, marginBottom: 12 }]}>
                  <Text style={[styles.tableRowLabel, { color: Colors.ui.textLight }]}>Pas de doublon</Text>
                  <Text style={[styles.tableRowValue, { color: Colors.ui.textLight }]}>0 graine</Text>
                </View>

                <TouchableOpacity style={styles.tableOkBtn} onPress={() => setShowTable(false)} activeOpacity={0.8}>
                  <Text style={styles.tableOkBtnText}>OK</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* ── Rouleaux (source des graines volantes) ───────────────────── */}
          <View style={styles.reelsRow} onLayout={onReelsLayout}>
            {([0, 1, 2] as const).map(i => (
              <Reel
                key={i}
                targetIndex={reelTargets[i]}
                spinning={phase === 'spinning'}
                stopDelay={1000 + i * 500} // rouleau 0 : 1s, 1 : 1.5s, 2 : 2s
                onStop={handleReelStop}
              />
            ))}
          </View>

          {/* ── Résultat ─────────────────────────────────────────────────── */}
          {phase === 'result' && result && (
            result.type === 'jackpot' ? (
              <Animated.View style={[styles.jackpotResultWrapper, {
                opacity: resultAnim,
                transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              }]}>
                <Text style={styles.jackpotEmoji}>🏆</Text>
                <Text style={styles.jackpotTitle}>JACKPOT !</Text>
                <Text style={styles.jackpotGain}>+{result.gain} graines</Text>
              </Animated.View>
            ) : (
              <Animated.View
                style={[styles.resultWrapper, { opacity: resultAnim, transform: [{ scale: resultAnim }] }]}
              >
                <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
              </Animated.View>
            )
          )}

          {/* ── Bouton Lancer ────────────────────────────────────────────── */}
          {(phase !== 'result' || isDevAccount) && (
            <TouchableOpacity
              style={[
                styles.spinBtn,
                (phase === 'spinning' || alreadyPlayed) && styles.spinBtnDisabled,
              ]}
              onPress={() => {
                if (isDevAccount && phase === 'result') {
                  // Rejouer : réinitialiser pour un nouveau spin
                  setPhase('idle');
                  setResult(null);
                  setStoppedCount(0);
                  setGainAmount(0);
                  setFlyActive(false);
                  setIsJackpotWin(false);
                  resultAnim.setValue(0);
                  jackpotFlash.setValue(0);
                } else {
                  handleSpin();
                }
              }}
              disabled={phase === 'spinning' || alreadyPlayed}
              activeOpacity={0.8}
            >
              <Text style={styles.spinBtnText}>
                {alreadyPlayed
                  ? 'Déjà joué aujourd\'hui'
                  : phase === 'result' && isDevAccount
                    ? 'Rejouer (dev)'
                    : 'Lancer la roulette'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Bouton Fermer ────────────────────────────────────────────── */}
          {(phase === 'result' || alreadyPlayed) && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Continuer</Text>
            </TouchableOpacity>
          )}
          {phase === 'idle' && !alreadyPlayed && (
            <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Passer</Text>
            </TouchableOpacity>
          )}

          {/* ── Graines volantes vers le compteur ───────────────────────── */}
          {flyActive && fromY !== null && counterY !== null && (
            <SeedFlyAnimation
              key={flyKey}
              count={launchedCount.current}
              fromX={fromX}
              fromY={fromY}
              targetX={counterX}
              targetY={counterY}
              onSeedArrived={onSeedArrived}
            />
          )}

          {/* ── Flash doré jackpot (overlay sur la carte) ───────────────── */}
          {isJackpotWin && (
            <Animated.View
              style={[styles.jackpotFlashOverlay, { opacity: jackpotFlash }]}
              pointerEvents="none"
            />
          )}

        </Animated.View>

        {/* ── Confetti jackpot (en dehors de la carte, plein écran) ──── */}
        {isJackpotWin && <Confetti pieces={confettiPieces} />}
      </Animated.View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  // ── Compteur de graines ───────────────────────────────────────────────────
  counterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  halo: {
    position: 'absolute',
    width: 90,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6FCF5A',
  },
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

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.forest.dark,
    marginBottom: 12,
  },
  jackpotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700' + '25',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
    width: '100%',
  },
  jackpotTree: { fontSize: 28 },
  jackpotLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C8A200',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jackpotAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#8B6E00',
  },
  tableBtn: {
    marginLeft: 'auto',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.forest.dark + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.forest.dark + '30',
  },
  tableBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  tableBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tableCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.ui.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  tableOkBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  tableOkBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.forest.dark,
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  tableSection: {
    marginBottom: 10,
  },
  tableSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tableSectionEmoji: {
    fontSize: 13,
  },
  tableSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  tableRowEmoji: {
    fontSize: 14,
  },
  tableRowJackpot: {
    backgroundColor: '#FFD700' + '25',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  tableRowLabelJackpot: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8B6E00',
    flex: 1,
  },
  tableRowValueJackpot: {
    fontSize: 14,
    fontWeight: '900',
    color: '#8B6E00',
  },
  tableRowLabel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    flex: 1,
    paddingLeft: 19, // aligné sous le titre de section (après emoji)
  },
  tableRowValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  tableNote: {
    fontSize: 10,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    paddingHorizontal: 4,
    lineHeight: 14,
  },
  reelsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    marginTop: 4,
    backgroundColor: Colors.forest.dark + '12',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.forest.dark + '25',
  },
  resultWrapper: {
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.ui.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.ui.border,
  },
  resultText: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  // ── Résultat jackpot ──────────────────────────────────────────────────────
  jackpotResultWrapper: {
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFD700',
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 12,
    width: '100%',
  },
  jackpotEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  jackpotTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#5C3A00',
    letterSpacing: 2,
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  jackpotGain: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5C3A00',
    marginTop: 4,
  },
  // ── Flash overlay jackpot ─────────────────────────────────────────────────
  jackpotFlashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFD700',
    borderRadius: 24,
    zIndex: 50,
  },
  spinBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  spinBtnDisabled: {
    backgroundColor: Colors.ui.border,
    opacity: 0.7,
  },
  spinBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
});
