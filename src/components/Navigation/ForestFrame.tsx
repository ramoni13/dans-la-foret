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
  ImageSourcePropType,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { usePlayerStore } from '../../store/playerStore';
import { useAudioStore } from '../../store/audioStore';
import { useRewardFlyStore } from '../../store/rewardFlyStore';
import { countTotalStars } from '../../constants/progression';
import { hasNewBadge } from '../../constants/ceremonies';
import { computeCountersGeometry } from '../../constants/counterLayout';
import { PROGRESSION_V2 } from '../../constants/featureFlags';
import ReAnimated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavStore } from '../../store/navStore';
import { useT } from '../../i18n';
import {
  BTN_X_CENTERS,
  computeFrameLayout,
} from '../../constants/frameLayout';

// ── Assets ────────────────────────────────────────────────────────────────────
const COIN_IMG      = require('../../../assets/cadre/coin.png');
const MENU_IMG      = require('../../../assets/cadre/menu_bas.png');
const BLOC_GRAINES  = require('../../../assets/elements/design_app/bloc_graines.png');
// Les blocs portent déjà leur icône (pomme de pin / graine) : le texte n'affiche que le nombre.
const BLOC_PP      = require('../../../assets/elements/design_app/bloc_pp.png');

// URI du SVG bordure — react-native-svg l'affiche sans bundler
const BORDURE_IMG = require('../../../assets/cadre/bordure.jpg');

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

// ── Pulsation d'un compteur quand une récompense arrive ────────────────────────
// Écoute pulses[target] du rewardFlyStore. Avec « réduire les animations » : pas de rebond.
function usePulseOnReward(target: 'seeds' | 'stars') {
  const pulses = useRewardFlyStore(s => s.pulses[target]);
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduceMotion) return;
    cancelAnimation(scale);
    scale.value = withSequence(
      withSpring(1.25, { damping: 5, stiffness: 450 }),
      withSpring(1, { damping: 7, stiffness: 280 }),
    );
  }, [pulses]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

// ── Un compteur du bandeau (pommes de pin ou graines) ──────────────────────────
// Chaque bloc porte déjà sa propre icône (bloc_pp.png : pomme de pin, bloc_graines.png : graine) :
// le texte n'affiche que le nombre, dans la couleur d'origine du bloc (pas de voile, pas d'icône en plus).
function CounterBlock({
  kind, value, geometry, source, a11yLabel, label,
}: {
  kind: 'seeds' | 'stars';
  value: number;
  geometry: { left: number; top: number; width: number; height: number; centerX: number; centerY: number };
  /** Image du bloc (cadre + icône). */
  source: ImageSourcePropType;
  a11yLabel: string;
  label: string;
}) {
  const pulseStyle = usePulseOnReward(kind);
  const setCounterPosition = useRewardFlyStore(s => s.setCounterPosition);
  const { left, top, width: w, height: h, centerX, centerY } = geometry;
  const textOffsetLeft = Math.round(w * 0.28);
  const textW          = Math.round(w * 0.62);

  // Centre absolu du compteur (le bandeau occupe l'écran entier : repère écran).
  React.useEffect(() => {
    setCounterPosition(kind, centerX, centerY);
  }, [kind, centerX, centerY]);

  return (
    <ReAnimated.View
      pointerEvents="none"
      accessible
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion="polite"
      style={[{ position: 'absolute', left, top, width: w, height: h }, pulseStyle]}
    >
      <Image
        source={source}
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
        <Text style={styles.seedsText} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
      </View>
    </ReAnimated.View>
  );
}

// ── Compteurs pommes de pin (à gauche) + graines (à droite) sur la barre haute ─
function CountersOverlay({ stars, seeds, screenW, topBarCenterY, coinW }: {
  stars: number;
  seeds: number;
  screenW: number;
  topBarCenterY: number;
  coinW: number;
}) {
  const t = useT();
  // Pommes de pin uniquement quand l'interface de progression est active ; sinon graines seules, comme avant.
  const g = computeCountersGeometry(screenW, topBarCenterY, coinW, PROGRESSION_V2);
  return (
    <>
      {g.stars && (
        <CounterBlock
          kind="stars"
          value={stars}
          geometry={g.stars}
          source={BLOC_PP}
          a11yLabel={t('frame_stars_a11y', { count: String(stars) })}
          label={String(stars)}
        />
      )}
      <CounterBlock
        kind="seeds"
        value={seeds}
        geometry={g.seeds}
        source={BLOC_GRAINES}
        a11yLabel={t('frame_seeds_a11y', { count: String(seeds) })}
        // Sans pommes de pin : libellé historique « N graines » ; avec : le nombre seul (deux compteurs).
        label={PROGRESSION_V2 ? String(seeds) : t('forest_frame_seeds', { count: String(seeds) })}
      />
    </>
  );
}
// ── Bouton son ─────────────────────────────────────────────────────────────────
// iconTopY : position Y du bord supérieur de l'icône (chantier 2 — aligné avec le bas du coin)
function SoundButton({ iconTopY }: { iconTopY: number }) {
  const t = useT();
  const menuEnabled = useAudioStore(s => s.menuEnabled);
  const setMenu     = useAudioStore(s => s.setMenuEnabled);
  const SIZE = 36;

  return (
    <TouchableOpacity
      style={[styles.soundBtn, { top: iconTopY, width: SIZE, height: SIZE }]}
      onPress={() => setMenu(!menuEnabled)}
      activeOpacity={0.8}
      accessibilityLabel={menuEnabled ? t('forest_frame_mute') : t('forest_frame_unmute')}
    >
      <Text style={styles.soundIcon}>{menuEnabled ? '🔊' : '🔇'}</Text>
    </TouchableOpacity>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function ForestFrame() {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const segments  = useSegments() as string[];
  const activeTab = getActiveTab(segments);
  const seeds     = usePlayerStore(s => s.seeds);
  const challengeStars = usePlayerStore(s => s.challengeStars);
  const totalStars = React.useMemo(() => countTotalStars(challengeStars), [challengeStars]);
  // Duel tout juste débloqué : pastille « Nouveau » sur l'onglet Défis jusqu'à la 1re partie (Lot 4)
  const duelIsNew = usePlayerStore(s => hasNewBadge('duel', s.newFeatureBadges));
  const { backLabel, onBack, hideBack, pendingFriendChallenges } = useNavStore();

  const {
    coinW, coinH,
    menuW70, menuH70, menuLeft,
    borderW,
    innerTop,
    btnY,
    tapHalf,
    topBarCenterY,
    iconTopY,
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

      {/* ── OVERLAYS (graines) ───────────────────────────────────────────── */}
      <CountersOverlay stars={totalStars} seeds={seeds} screenW={screenW} topBarCenterY={topBarCenterY} coinW={coinW} />

      {/* ── Zones de tap + voyant actif ──────────────────────────────────── */}
      {BUTTONS.map((btn) => {
        // Centre X du bouton = bord gauche du menu + fraction X dans le menu
        const btnX     = menuLeft + btn.xC * menuW70;
        const isActive = activeTab === btn.key;

        // Compteur rouge : défis d'amis en attente (le point « objectifs libres » du profil n'existe plus, Lot 8)
        const hasBadge = btn.key === 'challenge' && pendingFriendChallenges > 0;
        const badgeCount = pendingFriendChallenges;

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
            {btn.key === 'challenge' && duelIsNew && (
              <View pointerEvents="none" style={styles.newDot} accessible={false} importantForAccessibility="no">
                <Text style={styles.newDotText}>✦</Text>
              </View>
            )}
            {hasBadge && (
              <View pointerEvents="none" style={styles.badgeWrapper}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badgeCount > 9 ? '9+' : String(badgeCount)}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { borderRadius: tapHalf }]}
              onPress={() => {
                if (isActive && onBack != null) {
                  // Re-tap sur l'onglet actif → équivalent au bouton Retour
                  onBack();
                } else {
                  if (btn.key !== 'profile') hideBack();
                  router.push(btn.route as any);
                }
              }}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={btn.key === 'challenge' && duelIsNew ? t('ceremony_new_badge_a11y') : undefined}
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
  badgeWrapper: {
    position: 'absolute',
    top:      0,
    right:    0,
  },
  badge: {
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: '#E53935',
    borderWidth:     1.5,
    borderColor:     '#FFF',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize:   9,
    fontWeight: '800',
    color:      '#FFF',
    lineHeight: 12,
  },
  newDot: {
    position:        'absolute',
    top:             0,
    left:            0,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: '#FFC107',
    borderWidth:     1.5,
    borderColor:     '#FFF',
    alignItems:      'center',
    justifyContent:  'center',
  },
  newDotText: { fontSize: 9, fontWeight: '900', color: '#3E2F00', lineHeight: 12 },
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
  backTextBtn: {
    position:              'absolute',
    left:                  0,
    backgroundColor:       '#C8540A',
    paddingHorizontal:     12,
    paddingVertical:       8,
    borderTopRightRadius:  18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius:   0,
    borderBottomLeftRadius: 0,
    borderWidth:           1.5,
    borderLeftWidth:       0,
    borderColor:           '#FF8C42',
    shadowColor:           '#000',
    shadowOffset:          { width: 2, height: 2 },
    shadowOpacity:         0.45,
    shadowRadius:          4,
    elevation:             6,
    zIndex:                20,
  },
  backTextBtnLabel: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#fff',
  },
});
