// ============================================================
// ChallengeCountdown — Overlay de pré-défi
//
// Fond blanc plein écran + logo qui pulse + compte à rebours
// 3 → 2 → 1 → Go ! en dessous. Chaque chiffre pop-in en spring.
// Disparaît en fondu à la fin, puis appelle onDone().
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { usePlayerStore } from '../../store/playerStore';

const LOGO_FR = require('../../../assets/elements/design_app/danslaforet.jpeg');
const LOGO_EN = require('../../../assets/elements/design_app/intheforest.jpeg');

const STEPS = ['3', '2', '1'] as const;
const STEP_DURATION_MS = 800;

interface Props {
  onDone: () => void;
}

export function ChallengeCountdown({ onDone }: Props) {
  const language = usePlayerStore(s => s.language);
  const isEn = language === 'en';
  const { width, height } = useWindowDimensions();
  const logoWidth  = Math.min(width * 0.65, 280);
  const logoHeight = logoWidth * (765 / 1024);

  const [step, setStep] = useState(0);

  // Pulse du logo
  const pulse = useRef(new Animated.Value(1)).current;
  // Pop-in du chiffre courant
  const countScale   = useRef(new Animated.Value(0.3)).current;
  const countOpacity = useRef(new Animated.Value(0)).current;
  // Fondu de sortie de l'overlay entier
  const fadeOut = useRef(new Animated.Value(1)).current;

  const doneCalledRef = useRef(false);

  // ── Pulse infini du logo ──────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Pop-in d'un chiffre ───────────────────────────────────
  const popIn = () => {
    countScale.setValue(0.3);
    countOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(countScale, {
        toValue: 1,
        tension: 200,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(countOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ── Séquence principale ───────────────────────────────────
  useEffect(() => {
    popIn();

    const interval = setInterval(() => {
      setStep(prev => {
        const next = prev + 1;
        if (next < STEPS.length) {
          popIn();
          return next;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            Animated.timing(fadeOut, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }).start(() => {
              if (!doneCalledRef.current) {
                doneCalledRef.current = true;
                onDone();
              }
            });
          }, 350);
          return prev;
        }
      });
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut, width, height }]}>
      {/* Logo pulsant */}
      <Animated.Image
        source={isEn ? LOGO_EN : LOGO_FR}
        style={[{ width: logoWidth, height: logoHeight }, { transform: [{ scale: pulse }] }]}
        resizeMode="contain"
      />

      {/* Compte à rebours */}
      <Animated.Text
        style={[
          styles.count,
          styles.countNumber,
          { transform: [{ scale: countScale }], opacity: countOpacity },
        ]}
      >
        {STEPS[step]}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
    gap: 24,
  },
  count: {
    fontWeight: '900',
    textAlign: 'center',
  },
  countNumber: {
    fontSize: 120,
    color: '#2d5a1b',
    lineHeight: 128,
  },
});
