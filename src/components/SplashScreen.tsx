// ============================================================
// SplashScreen — Écran de démarrage
//
// Affiché au lancement le temps que Firebase réponde (authReady)
// et qu'un délai minimum de 2,5 s soit écoulé.
// Logo qui pulse (scale + opacité) + points de chargement animés.
// Fondu de sortie vers l'app.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  Text,
  Platform,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';

const LOGO_FR = require('../../assets/elements/design_app/danslaforet.jpeg');
const LOGO_EN = require('../../assets/elements/design_app/intheforest.jpeg');

// Ratio original 1024×765 → on laisse la largeur s'adapter, hauteur proportionnelle
const LOGO_RATIO = 765 / 1024;
const LOGO_WIDTH  = Math.min(Dimensions.get('window').width * 0.72, 320);
const LOGO_HEIGHT = LOGO_WIDTH * LOGO_RATIO;

const MIN_DURATION_MS = 2500;

interface Props {
  onDone: () => void;
}

export function AppSplashScreen({ onDone }: Props) {
  const language  = usePlayerStore(s => s.language);
  const authReady = usePlayerStore(s => s.authReady);

  // Pulse du logo : scale + opacité
  const pulse  = useRef(new Animated.Value(1)).current;
  // Fondu global de sortie
  const fadeOut = useRef(new Animated.Value(1)).current;

  const timerDoneRef  = useRef(false);
  const authDoneRef   = useRef(false);
  const exitingRef    = useRef(false);

  // Détection de la langue au moment du rendu (avant que le store soit hydraté,
  // on détecte via la locale système comme fallback)
  const isEn = language === 'en';

  // ── Animation pulse infinie ────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Sortie fluide ──────────────────────────────────────────
  const triggerExit = () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    Animated.timing(fadeOut, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => onDone());
  };

  const checkReady = () => {
    if (timerDoneRef.current && authDoneRef.current) {
      triggerExit();
    }
  };

  // ── Timer minimum ──────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      timerDoneRef.current = true;
      checkReady();
    }, MIN_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  // ── Attente authReady ──────────────────────────────────────
  useEffect(() => {
    if (authReady) {
      authDoneRef.current = true;
      checkReady();
    }
  }, [authReady]);

  // ── Points de chargement ───────────────────────────────────
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 450);
    return () => clearInterval(id);
  }, []);

  const loadingText = isEn
    ? `Loading${dots}`
    : `Chargement${dots}`;

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <Animated.Image
        source={isEn ? LOGO_EN : LOGO_FR}
        style={[
          styles.logo,
          { transform: [{ scale: pulse }] },
        ]}
        resizeMode="contain"
      />
      <Text style={styles.loadingText}>{loadingText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  loadingText: {
    marginTop: 32,
    fontSize: 13,
    fontWeight: '500',
    color: '#6a9a4a',
    letterSpacing: 1.2,
    // Largeur fixe pour éviter le saut au changement de points
    minWidth: 120,
    textAlign: 'center',
  },
});
