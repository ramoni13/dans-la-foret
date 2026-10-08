// ============================================================
// IntroSlide — Première slide du briefing + carte dans Règles
//
// 4 cercles espacés généreusement, reliés par une seule ligne
// (chemin 0 → 1 → 2 → 3), sprites qui tombent en boucle.
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useT } from '../../i18n';
import { ELEMENT_SPRITES } from './RuleAnimations/sprites';

const native = Platform.OS !== 'web';

// ── Canvas ───────────────────────────────────────────────────
const CANVAS_W = 280;
const CANVAS_H = 240;
const R = 30; // rayon de chaque cercle

// ── 4 positions en losange bien espacé ───────────────────────
//   0 (haut-gauche)   1 (haut-droite)
//   2 (bas-gauche)    3 (bas-droite)
const M = 52; // marge bord → centre cercle
const POS = [
  { cx: M,            cy: M },             // 0 — haut-gauche
  { cx: CANVAS_W - M, cy: M },             // 1 — haut-droite
  { cx: M,            cy: CANVAS_H - M },  // 2 — bas-gauche
  { cx: CANVAS_W - M, cy: CANVAS_H - M },  // 3 — bas-droite
];

// Chemin unique : 0 → 1 → 3 → 2  (Z traversant le canvas)
const PATH_ORDER = [0, 1, 3, 2];

// Points SVG pour <Polyline>
const POLYLINE_POINTS = PATH_ORDER
  .map(i => `${POS[i].cx},${POS[i].cy}`)
  .join(' ');

// ── Éléments (un par cercle, dans l'ordre de PATH_ORDER) ─────
const SPRITES_IDS = ['bucheron', 'ours', 'mouton', 'chien'];

// ── Timing ───────────────────────────────────────────────────
const TOKEN_DELAY = 500;  // ms entre chaque apparition
const LOOP_PAUSE  = 2200; // ms de pause avant relance

// ── Composant ────────────────────────────────────────────────
export const IntroSlide: React.FC = () => {
  const t = useT();

  const anims = useRef(
    SPRITES_IDS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    let cancelled = false;

    const runLoop = () => {
      if (cancelled) return;
      anims.forEach(a => a.setValue(0));

      const drops = SPRITES_IDS.map((_, i) =>
        Animated.sequence([
          Animated.delay(i * TOKEN_DELAY),
          Animated.spring(anims[i], {
            toValue: 1,
            useNativeDriver: native,
            speed: 16,
            bounciness: 12,
          }),
        ])
      );

      Animated.stagger(0, drops).start(() => {
        if (!cancelled) setTimeout(runLoop, LOOP_PAUSE);
      });
    };

    runLoop();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={styles.container}>
      {/* Textes */}
      <Text style={styles.title}>{t('briefing_intro_title')}</Text>
      <Text style={styles.body}>{t('briefing_intro_body')}</Text>

      {/* Diagramme */}
      <View style={{ width: CANVAS_W, height: CANVAS_H }}>

        {/* Ligne unique reliant les 4 cercles */}
        <Svg
          width={CANVAS_W}
          height={CANVAS_H}
          style={StyleSheet.absoluteFill}
        >
          <Polyline
            points={POLYLINE_POINTS}
            fill="none"
            stroke="rgba(255,255,255,0.30)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        {/* Cercles + sprites */}
        {POS.map((pos, i) => {
          const spriteId = SPRITES_IDS[i];
          const sprite   = ELEMENT_SPRITES[spriteId];

          const translateY = anims[i].interpolate({
            inputRange:  [0, 1],
            outputRange: [-30, 0],
          });
          const opacity = anims[i].interpolate({
            inputRange:  [0, 0.18, 1],
            outputRange: [0, 1, 1],
          });
          const scale = anims[i].interpolate({
            inputRange:  [0, 1],
            outputRange: [0.55, 1],
          });

          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  left:         pos.cx - R,
                  top:          pos.cy - R,
                  width:        R * 2,
                  height:       R * 2,
                  borderRadius: R,
                },
              ]}
            >
              <Animated.View
                style={{
                  transform: [{ translateY }, { scale }],
                  opacity,
                }}
              >
                <Image
                  source={sprite}
                  style={styles.tokenImg}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 21,
  },
  cell: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tokenImg: {
    width: R * 1.45,
    height: R * 1.45,
  },
});
