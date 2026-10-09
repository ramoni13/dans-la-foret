// ============================================================
// ForestFrame — Cadre bois + navigation plein écran
//
// Ce composant se positionne en absolu par-dessus le contenu Expo Router.
// Il affiche :
//   1. Le PNG cadre_vide.png aligné par le bas (le haut déborde hors écran)
//   2. 4 TouchableOpacity invisibles sur les boutons dessinés dans le cadre
//   3. Un petit voyant vert solide (ActiveDot) sur le bouton de l'onglet actif
//   4. Le compteur de graines centré sur la barre du bas du cadre
//   5. Le bouton son (🔊/🔇) positionné dans le coin supérieur droit du cadre
//
// Le PNG natif fait 1536×2752 (ratio ≈ 1.792).
// Positions des boutons mesurées sur ce PNG :
//   X centres : 19.3% | 39.7% | 60.3% | 80.8% de la largeur du cadre
//   Y centre  : 93.5% de la hauteur du cadre
//   Rayon zone de tap : ~10% de la largeur du cadre
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
const CADRE_IMG     = require('../../../assets/elements/design_app/cadre_vide.png');
const BLOC_GRAINES  = require('../../../assets/elements/design_app/bloc_graines.png');
const FLECHE_GAUCHE = require('../../../assets/elements/design_app/fleche_gauche.png');

// ── Ratio natif bloc_graines : 264×85 ─────────────────────────────────────────
const SEEDS_RATIO = 264 / 85;

// ── Définition des 4 boutons (coordonnées relatives sur le PNG) ────────────────
const BUTTONS = [
  { key: 'index',     xC: BTN_X_CENTERS[0], route: '/(tabs)/'         },
  { key: 'rules',     xC: BTN_X_CENTERS[1], route: '/(tabs)/rules'    },
  { key: 'challenge', xC: BTN_X_CENTERS[2], route: '/(tabs)/challenge' },
  { key: 'profile',   xC: BTN_X_CENTERS[3], route: '/(tabs)/profile'  },
] as const;

const BTN_TAP_HALF = 0.10; // demi-taille de la zone de tap (fraction largeur)

// Décalage vertical supplémentaire (px) pour descendre le compteur graines
// et le bouton son dans la barre haute, sans affecter le padding des écrans.
const OVERLAY_NUDGE_Y = 14;

// ── Utilitaire : onglet actif depuis les segments Expo Router ─────────────────
function getActiveTab(segments: string[]): string {
  if (segments.includes('rules'))     return 'rules';
  if (segments.includes('challenge')) return 'challenge';
  if (segments.includes('profile'))   return 'profile';
  return 'index';
}

// ── Petit voyant vert solide ──────────────────────────────────────────────────
function ActiveDot() {
  const SIZE = 8;
  return (
    <View
      pointerEvents="none"
      style={{
        width:        SIZE,
        height:       SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: '#48D250',
        shadowColor:  '#48D250',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius:  4,
        elevation:     6,
      }}
    />
  );
}

// ── Compteur de graines centré sur la barre HAUTE du cadre ──────────────────
function SeedsOverlay({ seeds, cadreW, cadreTop, topBarH }: {
  seeds: number;
  cadreW: number;
  cadreTop: number;
  topBarH: number;
}) {
  // Largeur du bloc : environ 45% du cadre, max 200px
  const w = Math.min(200, Math.round(cadreW * 0.45));
  const h = Math.round(w / SEEDS_RATIO);
  const textOffsetLeft = Math.round(w * 0.28);
  const textW          = Math.round(w * 0.62);

  // Centre vertical de la barre haute du cadre + décalage visuel
  const barCenterY = cadreTop + topBarH / 2 + OVERLAY_NUDGE_Y;

  return (
    <View
      pointerEvents="none"
      style={{
        position:  'absolute',
        // Centré horizontalement sur le cadre
        left:      (cadreW - w) / 2,
        // Centré verticalement dans la barre bois haute (avec nudge)
        top:       barCenterY - h / 2,
        width:     w,
        height:    h,
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
        <Text
          style={{
            fontSize:          14,
            fontWeight:        '800',
            color:             '#FFF8E7',
            textShadowColor:   'rgba(0,0,0,0.7)',
            textShadowOffset:  { width: 0, height: 1 },
            textShadowRadius:  4,
          }}
        >
          {seeds} graines
        </Text>
      </View>
    </View>
  );
}

// ── Bouton son dans le coin supérieur droit de la barre haute du cadre ────────
function SoundButton({ cadreW, cadreTop, topBarH }: {
  cadreW: number;
  cadreTop: number;
  topBarH: number;
}) {
  const menuEnabled = useAudioStore(s => s.menuEnabled);
  const setMenu     = useAudioStore(s => s.setMenuEnabled);

  const SIZE = 36;
  // Centré verticalement dans la barre bois haute + décalage visuel + 10px vers le bas
  const barCenterY = cadreTop + topBarH / 2 + OVERLAY_NUDGE_Y + 10;
  // Collé au bord droit de l'écran
  const rightOffset = 0;

  return (
    <TouchableOpacity
      style={[
        styles.soundBtn,
        {
          top:    barCenterY - SIZE / 2,
          right:  rightOffset,
          width:  SIZE,
          height: SIZE,
        },
      ]}
      onPress={() => setMenu(!menuEnabled)}
      activeOpacity={0.8}
      accessibilityLabel={menuEnabled ? 'Couper le son' : 'Activer le son'}
    >
      <Text style={styles.soundIcon}>{menuEnabled ? '🔊' : '🔇'}</Text>
    </TouchableOpacity>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ForestFrame() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const segments  = useSegments() as string[];
  const activeTab = getActiveTab(segments);
  const seeds     = usePlayerStore(s => s.seeds);
  const { backLabel, onBack } = useNavStore();

  // ── Calcul des dimensions du cadre — mode "cover" ────────────────────────
  // Le cadre couvre toujours toute la hauteur visible (exclut la barre nav Android).
  // cadreTop est toujours ≤ 0 : le cadre déborde en haut, jamais de zone vide.
  const visibleH = screenH - insets.bottom;
  const { cadreW, cadreH, cadreTop, cadreLeft, topBarH, btnY } = computeFrameLayout(screenW, visibleH);

  // ── Dimensions des zones de tap en pixels ─────────────────────────────────
  const tapHalf  = BTN_TAP_HALF * cadreW;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="box-none">

      {/* ── Image du cadre bois (PNG transparent) ──────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left:     cadreLeft,  // centré si cadreW > screenW (mode cover height)
          top:      cadreTop,   // ≤ 0, le cadre déborde en haut
          width:    cadreW,
          height:   cadreH,
        }}
      >
        <Image
          source={CADRE_IMG}
          style={{ width: '100%', height: '100%' }}
          resizeMode="stretch"
        />
      </View>

      {/* ── Compteur de graines sur la barre haute ──────────────────────── */}
      <SeedsOverlay
        seeds={seeds}
        cadreW={cadreW}
        cadreTop={cadreTop}
        topBarH={topBarH}
      />

      {/* ── Bouton son dans le coin haut du cadre ───────────────────────── */}
      <SoundButton
        cadreW={cadreW}
        cadreTop={cadreTop}
        topBarH={topBarH}
      />

      {/* ── Bouton Retour (visible uniquement sur l'onglet profile, quand une sous-section est active) */}
      {backLabel != null && onBack != null && activeTab === 'profile' && (() => {
        const SIZE = 36;
        // Même formule que SoundButton pour être aligné sur la même ligne
        const barCenterY = cadreTop + topBarH / 2 + OVERLAY_NUDGE_Y + 10;
        const top  = barCenterY - SIZE / 2;
        const left = 0;
        return (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.8}
            style={[styles.backCircleBtn, { top, left, width: SIZE, height: SIZE, borderRadius: SIZE / 2 }]}
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

      {/* ── Zones de tap invisibles + voyant actif ──────────────────────── */}
      {BUTTONS.map((btn) => {
        const btnX     = btn.xC * cadreW + cadreLeft;
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
            {/* Voyant vert sur le bouton actif — centré en bas de la zone de tap */}
            {isActive && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom:   0,
                  left:     0,
                  right:    0,
                  alignItems: 'center',
                }}
              >
                <ActiveDot />
              </View>
            )}

            {/* Zone cliquable transparente */}
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
  root: {
    // Pas d'overflow:hidden — le cadre PNG peut légèrement déborder en haut
    // sur les écrans dont le ratio est plus allongé que le PNG (mode cover).
  },
  soundBtn: {
    position:        'absolute',
    borderRadius:    20,
    backgroundColor: '#5C3010',
    borderWidth:     2,
    borderColor:     '#3B1E08',
    alignItems:      'center',
    justifyContent:  'center',
    // Ombre pour accentuer le relief bois
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.5,
    shadowRadius:    3,
    elevation:       4,
  },
  soundIcon: {
    fontSize: 20,
  },
  // Bouton Retour — cercle style haut-parleur
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
