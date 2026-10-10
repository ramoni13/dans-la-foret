// ============================================================
// ForestFrame — Cadre bois modulaire + navigation plein écran
//
// Assemblage de 3 assets :
//   coin.png      (558×549) — original = coin haut-droit
//   bordure.svg   (21.76×278.4) — bande verticale extensible
//   menu_bas.png  (1352×318) — barre navigation basse
//
// Disposition :
//   ┌─[coin TG scaleX:-1]────────────[coin TD]─┐
//   [bord G]         contenu         [bord D scaleX:-1]
//   └─────────────[menu_bas]─────────────────────┘
//
// Les coins sont symétriques via scaleX/scaleY (pas de rotate).
// La bordure SVG s'étire en hauteur (preserveAspectRatio="none" dans le SVG).
// Le menu_bas est pleine largeur, hauteur calculée depuis son ratio natif.
// ============================================================

import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { usePlayerStore } from '../../store/playerStore';
import { useAudioStore } from '../../store/audioStore';
import { useNavStore } from '../../store/navStore';
import {
  BTN_X_CENTERS,
  computeFrameLayout,
} from '../../constants/frameLayout';

// ── Assets ────────────────────────────────────────────────────────────────────
const COIN_IMG      = require('../../../assets/cadre/coin.png');
const MENU_IMG      = require('../../../assets/cadre/menu_bas.png');
const BLOC_GRAINES  = require('../../../assets/elements/design_app/bloc_graines.png');
const FLECHE_GAUCHE = require('../../../assets/elements/design_app/fleche_gauche.png');

// URI du SVG bordure — react-native-svg l'affiche sans bundler
const BORDURE_IMG = require('../../../assets/cadre/bordure.jpg');

// ── Ratio natif bloc_graines : 264×85 ─────────────────────────────────────────
const SEEDS_RATIO = 264 / 85;

// ── Définition des 4 boutons nav ──────────────────────────────────────────────
const BUTTONS = [
  { key: 'index',     xC: BTN_X_CENTERS[0], route: '/(tabs)/'         },
  { key: 'rules',     xC: BTN_X_CENTERS[1], route: '/(tabs)/rules'    },
  { key: 'challenge', xC: BTN_X_CENTERS[2], route: '/(tabs)/challenge' },
  { key: 'profile',   xC: BTN_X_CENTERS[3], route: '/(tabs)/profile'  },
] as const;

// ── Utilitaire : onglet actif ──────────────────────────────────────────────────
function getActiveTab(segments: string[]): string {
  if (segments.includes('rules'))     return 'rules';
  if (segments.includes('challenge')) return 'challenge';
  if (segments.includes('profile'))   return 'profile';
  return 'index';
}

// ── Voyant vert (onglet actif) ─────────────────────────────────────────────────
function ActiveDot() {
  return (
    <View
      pointerEvents="none"
      style={styles.activeDot}
    />
  );
}

// ── Compteur de graines sur la barre haute ─────────────────────────────────────
function SeedsOverlay({ seeds, screenW, topBarCenterY }: {
  seeds: number;
  screenW: number;
  topBarCenterY: number;
}) {
  const w = Math.min(200, Math.round(screenW * 0.45));
  const h = Math.round(w / SEEDS_RATIO);
  const textOffsetLeft = Math.round(w * 0.28);
  const textW          = Math.round(w * 0.62);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left:     (screenW - w) / 2,
        top:      topBarCenterY - h / 2,
        width:    w,
        height:   h,
      }}
    >
      <Image
        source={BLOC_GRAINES}
        style={{ width: w, height: h, position: 'absolute' }}
        resizeMode="contain"
      />
      <View
        style={{
          position:       'absolute',
          left:           textOffsetLeft,
          width:          textW,
          height:         h,
          justifyContent: 'center',
          alignItems:     'center',
        }}
      >
        <Text style={styles.seedsText}>{seeds} graines</Text>
      </View>
    </View>
  );
}

// ── Bouton son ─────────────────────────────────────────────────────────────────
function SoundButton({ topBarCenterY }: { topBarCenterY: number }) {
  const menuEnabled = useAudioStore(s => s.menuEnabled);
  const setMenu     = useAudioStore(s => s.setMenuEnabled);
  const SIZE = 36;

  return (
    <TouchableOpacity
      style={[styles.soundBtn, { top: topBarCenterY - SIZE / 2, width: SIZE, height: SIZE }]}
      onPress={() => setMenu(!menuEnabled)}
      activeOpacity={0.8}
      accessibilityLabel={menuEnabled ? 'Couper le son' : 'Activer le son'}
    >
      <Text style={styles.soundIcon}>{menuEnabled ? '🔊' : '🔇'}</Text>
    </TouchableOpacity>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function ForestFrame() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const segments  = useSegments() as string[];
  const activeTab = getActiveTab(segments);
  const seeds     = usePlayerStore(s => s.seeds);
  const { backLabel, onBack } = useNavStore();

  const {
    coinW, coinH,
    menuW70, menuH70, menuLeft,
    borderW,
    innerTop,
    btnY,
    tapHalf,
    topBarCenterY,
  } = computeFrameLayout(screenW, screenH, insets.bottom);

  // Bordures H : de coinW/2 à coinW/2 (commence et finit au centre de chaque coin)
  const horizW = screenW - coinW;
  // Décalage pour centrer la bande pivotée dans le conteneur
  const delta  = (horizW - borderW) / 2;

  /** Bordures verticales :
   *  top    = topBarCenterY + coinH/2 (centre du coin haut)
   *  bottom = screenH                 (bas de l'écran, sous les coins bas)
   *  Les coins (rendus après) recouvrent les extrémités. */
  const borderVTop = topBarCenterY + coinH / 2;
  const borderH    = Math.max(0, screenH - borderVTop);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ────────────────────────────────────────────────────────────────────
          GÉOMÉTRIE DU CADRE
          ─────────────────────────────────────────────────────────────────────
          bordure.jpg : bande verticale, côté foncé à DROITE du JPEG.

          Bordures verticales :
            Gauche  → scaleX:-1  (retourne le foncé vers la droite = vers le centre)
            Droite  → pas de flip (foncé déjà à gauche visuellement = vers le centre)

          Bordures horizontales — technique "rotate dans un conteneur clippé" :
            L'image a ses dimensions de layout normales (borderH × borderW).
            Elle est centrée horizontalement dans le conteneur (horizW × borderW).
            La rotation 90° est appliquée autour de son centre géométrique :
              après rotation, elle couvre borderH dp en X et borderW dp en Y visuellement.
            Le conteneur overflow:hidden clippe ce qui dépasse.
            Si borderH < horizW le contenu est insuffisant — on scale via scaleX.

            rotate('90deg') : le côté DROIT du JPEG (foncé) va vers le BAS du rendu.
              Bordure haute  → rotate('90deg')              foncé vers le bas = vers l'intérieur ✓
              Bordure basse  → rotate('90deg') + scaleY:-1  foncé vers le haut = vers l'intérieur ✓

          Menu bas :
            Positionné au-dessus de la bordure basse : bottom = borderW
            Centré horizontalement : left = (screenW - menuW) / 2
          Bordure basse :
            Collée au bas de l'écran : bottom = 0
          ─────────────────────────────────────────────────────────────────────── */}

      {/* ── BORDURE HAUTE ──────────────────────────────────────────────────── */}
      <View style={{
        position: 'absolute',
        top: topBarCenterY,
        left: coinW / 2,
        width: horizW,
        height: borderW,
        overflow: 'hidden',
      }}>
        <Image
          source={BORDURE_IMG}
          style={{
            position: 'absolute',
            width: borderW, height: horizW,
            left: delta, top: -delta,
            transform: [{ rotate: '-90deg' }],
          }}
          resizeMode="stretch"
        />
      </View>

      {/* ── BORDURES VERTICALES ────────────────────────────────────────────── */}
      {borderH > 0 && (
        <>
          <Image
            source={BORDURE_IMG}
            style={{
              position: 'absolute', left: 0, top: borderVTop,
              width: borderW, height: borderH,
              transform: [{ scaleX: -1 }],
            }}
            resizeMode="stretch"
          />
          <Image
            source={BORDURE_IMG}
            style={{
              position: 'absolute', right: 0, top: borderVTop,
              width: borderW, height: borderH,
            }}
            resizeMode="stretch"
          />
        </>
      )}

      {/* ── COINS HAUTS — alignés avec la bordure haute ─────────────────── */}
      {/* Coin haut-droit (original) */}
      <Image
        source={COIN_IMG}
        style={[styles.coin, { width: coinW, height: coinH, top: topBarCenterY, right: 0 }]}
        resizeMode="contain"
      />
      {/* Coin haut-gauche (miroir horizontal) */}
      <Image
        source={COIN_IMG}
        style={[styles.coin, { width: coinW, height: coinH, top: topBarCenterY, left: 0,
          transform: [{ scaleX: -1 }] }]}
        resizeMode="contain"
      />

      {/* ── MENU BAS — juste au-dessus de la bordure basse ───────────────── */}
      <Image
        source={MENU_IMG}
        style={{
          position: 'absolute',
          bottom:   borderW,
          left:     menuLeft,
          width:    menuW70,
          height:   menuH70,
        }}
        resizeMode="stretch"
      />

      {/* ── BORDURE BASSE — collée au bas de l'écran ──────────────────────── */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: coinW / 2,
        width: horizW,
        height: borderW,
        overflow: 'hidden',
      }}>
        <Image
          source={BORDURE_IMG}
          style={{
            position: 'absolute',
            width: borderW, height: horizW,
            left: delta, top: -delta,
            transform: [{ rotate: '90deg' }, { scaleY: -1 }],
          }}
          resizeMode="stretch"
        />
      </View>

      {/* ── COINS BAS — par-dessus le menu ────────────────────────────────── */}
      <Image
        source={COIN_IMG}
        style={[styles.coin, {
          width: coinW, height: coinH,
          bottom: 0, right: 0,
          transform: [{ scaleY: -1 }],
        }]}
        resizeMode="contain"
      />
      <Image
        source={COIN_IMG}
        style={[styles.coin, {
          width: coinW, height: coinH,
          bottom: 0, left: 0,
          transform: [{ scaleX: -1 }, { scaleY: -1 }],
        }]}
        resizeMode="contain"
      />

      {/* ── OVERLAYS (graines + son) ──────────────────────────────────────── */}
      <SeedsOverlay seeds={seeds} screenW={screenW} topBarCenterY={topBarCenterY} />
      <SoundButton topBarCenterY={topBarCenterY} />

      {/* ── Bouton Retour (onglet profile) ───────────────────────────────── */}
      {backLabel != null && onBack != null && activeTab === 'profile' && (() => {
        const SIZE = 36;
        return (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.8}
            style={[styles.backCircleBtn, {
              top:    topBarCenterY - SIZE / 2,
              left:   0,
              width:  SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
            }]}
            accessibilityLabel="Retour"
          >
            <Image
              source={FLECHE_GAUCHE}
              style={{ width: SIZE * 0.55, height: SIZE * 0.55 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        );
      })()}

      {/* ── Zones de tap + voyant actif ──────────────────────────────────── */}
      {BUTTONS.map((btn) => {
        // Centre X du bouton = bord gauche du menu + fraction X dans le menu
        const btnX     = menuLeft + btn.xC * menuW70;
        const isActive = activeTab === btn.key;

        return (
          <View
            key={btn.key}
            pointerEvents="box-none"
            style={{
              position:       'absolute',
              left:           btnX - tapHalf,
              top:            btnY - tapHalf,
              width:          tapHalf * 2,
              height:         tapHalf * 2,
              borderRadius:   tapHalf,
              alignItems:     'center',
              justifyContent: 'center',

            }}
          >
            {isActive && (
              <View pointerEvents="none" style={styles.activeDotWrapper}>
                <ActiveDot />
              </View>
            )}
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { borderRadius: tapHalf }]}
              onPress={() => router.push(btn.route as any)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    position: 'absolute',
  },
  activeDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#48D250',
    shadowColor:     '#48D250',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.8,
    shadowRadius:    4,
    elevation:       6,
  },
  activeDotWrapper: {
    position:   'absolute',
    bottom:     0,
    left:       0,
    right:      0,
    alignItems: 'center',
  },
  seedsText: {
    fontSize:         14,
    fontWeight:       '800',
    color:            '#FFF8E7',
    textShadowColor:  'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  soundBtn: {
    position:        'absolute',
    right:           0,
    borderRadius:    20,
    backgroundColor: '#5C3010',
    borderWidth:     2,
    borderColor:     '#3B1E08',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.5,
    shadowRadius:    3,
    elevation:       4,
  },
  soundIcon: {
    fontSize: 20,
  },
  backCircleBtn: {
    position:        'absolute',
    backgroundColor: '#5C3010',
    borderWidth:     2,
    borderColor:     '#3B1E08',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.5,
    shadowRadius:    3,
    elevation:       4,
  },
});
