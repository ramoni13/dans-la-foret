// ============================================================
// TREE CARD VIEW — Carte arbre retournable (Herbier de la Forêt)
//
// Recto : image plein format + badge # + nom en bas sur voile sombre
//         + effet foil (shimmer diagonal animé en boucle Reanimated)
// Verso : mise en page parchemin, typographie généreuse, anecdote flex
//
// Animation flip : opacity + scaleX (fiable cross-platform Reanimated 4.5)
// Pas de LinearGradient — tout en View superposées.
// ============================================================

import React, { useCallback, useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { TreeCard, TREE_IMAGES } from '../../data/treesData';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

const ONF_LOGO = require('../../../assets/elements/design_app/logo-onf.png');

// ── Dimensions de référence ───────────────────────────────────────────────────
const REF_W = 300;
const REF_H = 480;

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  // Recto
  frontBg:     '#1A3A1A',   // identique au fond des slides de briefing
  frameBorder: '#C9A84C',
  frameInner:  '#E8C96A',
  nameBg:      'rgba(10,30,10,0.82)',
  nameText:    '#F5EDD0',
  fallbackBg:  '#1A3A1A',
  numBg:       'rgba(0,0,0,0.45)',
  numText:     '#C9A84C',

  // Verso
  backBg:      '#FEFAF0',
  backBorder:  '#A0845A',
  darkGreen:   '#1A3C1A',
  midGreen:    '#2D6A2D',
  latinColor:  '#6B4C2A',
  geoColor:    '#3D5A6A',
  geoBg:       '#EDF4F0',
  anecBg:      '#E6F4E6',
  anecText:    '#1B5025',
  anecBorder:  '#A8D4A8',
  gold:        '#C9A84C',
  mutedText:   '#9E8E78',
  footerText:  '#6B8C6B',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface TreeCardViewProps {
  tree: TreeCard;
  size?: 'normal' | 'mini';
  cardWidth?: number;
  cardHeight?: number;
  startFlipped?: boolean;
  locked?: boolean;
}

// ── Sous-composant : effet foil shimmer ───────────────────────────────────────
// Une seule bande fine et diagonale, couleur unie, opacité animée en pulse.
// Pas de sous-bandes — juste un reflet propre qui glisse puis s'estompe.
function FoilShimmer({ w, h }: { w: number; h: number }) {
  const pos     = useSharedValue(-w * 0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Glissement + fondu en boucle avec pause entre chaque passage
    const loop = () => {
      pos.value     = -w * 0.6;
      opacity.value = 0;
      opacity.value = withSequence(
        withTiming(1,   { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(0.9, { duration: 1400 }),
        withTiming(0,   { duration: 300, easing: Easing.in(Easing.quad) }),
      );
      pos.value = withSequence(
        withTiming(w * 1.4, {
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(w * 1.4, { duration: 2500 }), // pause avant prochain passage
      );
    };
    loop();
    pos.value = withRepeat(
      withSequence(
        withTiming(-w * 0.6, { duration: 0 }),
        withTiming(w * 1.4, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(w * 1.4, { duration: 2500 }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0,   { duration: 0 }),
        withTiming(1,   { duration: 300,  easing: Easing.out(Easing.quad) }),
        withTiming(0.85,{ duration: 1400 }),
        withTiming(0,   { duration: 300,  easing: Easing.in(Easing.quad) }),
        withTiming(0,   { duration: 2500 }), // pause
      ),
      -1,
      false,
    );
  }, [w, h]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: pos.value }],
  }));

  // Bande fine (w * 0.12) inclinée à 20° — une seule couleur, pas de sous-bandes
  const bandW  = Math.round(w * 0.12);
  const diagH  = Math.round(h * 2.2);

  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 14 }]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          {
            position:        'absolute',
            top:             -diagH * 0.1,
            left:            0,
            width:           bandW,
            height:          diagH,
            backgroundColor: 'rgba(255,245,200,0.55)',
            borderRadius:    bandW / 2,
            transform:       [{ rotate: '20deg' }],
          },
          animStyle,
        ]}
      />
    </View>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function TreeCardView({
  tree,
  size = 'normal',
  cardWidth,
  cardHeight,
  startFlipped = false,
  locked = false,
}: TreeCardViewProps) {
  const t        = useT();
  const language = usePlayerStore(s => s.language);
  const isEn     = language === 'en';
  const treeName = isEn ? tree.name_en : tree.name_fr;
  const treeGeo  = isEn ? tree.geo_location_en : tree.geo_location;
  const treeAnec = isEn ? tree.anecdote_en : tree.anecdote;
  const preset = size === 'mini' ? { width: 150, height: 240 } : { width: REF_W, height: REF_H };
  const w      = cardWidth  ?? preset.width;
  const h      = cardHeight ?? preset.height;
  const isMini = w < 200;
  const s      = h / REF_H; // facteur d'échelle

  const progress = useSharedValue(startFlipped ? 1 : 0);

  const flip = useCallback(() => {
    if (locked) return;
    progress.value = withTiming(progress.value < 0.5 ? 1 : 0, { duration: 480 });
  }, [locked]);

  const frontAnim = useAnimatedStyle(() => ({
    opacity:   progress.value < 0.5 ? 1 : 0,
    transform: [{ scaleX: progress.value < 0.5 ? 1 - progress.value * 2 : 0 }],
  }));

  const backAnim = useAnimatedStyle(() => ({
    opacity:   progress.value >= 0.5 ? 1 : 0,
    transform: [{ scaleX: progress.value >= 0.5 ? (progress.value - 0.5) * 2 : 0 }],
  }));

  const image  = TREE_IMAGES[tree.id];
  const cardSz = { width: w, height: h };
  const pad    = Math.round(14 * s);
  const r      = Math.round(16 * s); // border-radius

  // ── Recto ─────────────────────────────────────────────────────────────────
  const recto = (
    <Animated.View style={[styles.card, cardSz, { borderRadius: r, borderWidth: Math.round(3 * s), borderColor: C.frameBorder }, frontAnim]}>

      {/* Fond vert foncé (toujours visible derrière l'image) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.frontBg }]} />

      {/* Image plein format — cover centré sur toute la carte */}
      {image ? (
        <Image source={image} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: Math.round(64 * s) }}>🌳</Text>
        </View>
      )}

      {/* Dégradé bas — une seule couche dense en bas */}
      <View style={[StyleSheet.absoluteFill, {
        bottom: 0, top: '80%',
        backgroundColor: 'rgba(8,24,8,0.78)',
        borderBottomLeftRadius: r - 2, borderBottomRightRadius: r - 2,
      }]} />

      {/* Voile haut — fine bande pour lisibilité des badges */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: Math.round(48 * s),
        backgroundColor: 'rgba(0,0,0,0.28)',
        borderTopLeftRadius: r - 2, borderTopRightRadius: r - 2,
      }} />

      {/* Badge numéro — haut gauche, pastille dorée */}
      <View style={[styles.numBadge, {
        top: Math.round(10 * s),
        left: Math.round(10 * s),
        borderRadius: Math.round(5 * s),
        paddingHorizontal: Math.round(7 * s),
        paddingVertical: Math.round(3 * s),
      }]}>
        <Text style={[styles.numBadgeText, { fontSize: Math.round((isMini ? 8 : 10) * s) }]}>
          #{String(tree.id).padStart(3, '0')}
        </Text>
      </View>

      {/* Logo ONF — haut droite */}
      <View style={[styles.onfLogoWrapper, {
        top: Math.round(8 * s),
        right: Math.round(10 * s),
        left: undefined,
        alignItems: 'flex-end',
      }]}>
        <Image
          source={ONF_LOGO}
          style={{ width: Math.round((isMini ? 40 : 64) * s), height: Math.round((isMini ? 20 : 32) * s) }}
          resizeMode="contain"
        />
      </View>

      {/* Zone texte bas — sur le dégradé, pas de fond opaque supplémentaire */}
      <View style={[styles.frontBottom, { paddingHorizontal: Math.round(14 * s), paddingBottom: Math.round(14 * s), paddingTop: Math.round(8 * s) }]}>
        {/* Pill type image */}
        {!isMini && (
          <View style={[styles.typePill, {
            borderRadius: Math.round(4 * s),
            paddingHorizontal: Math.round(7 * s),
            paddingVertical: Math.round(2 * s),
            marginBottom: Math.round(6 * s),
            alignSelf: 'flex-start',
          }]}>
            <Text style={[styles.typePillText, { fontSize: Math.round(9 * s), letterSpacing: Math.round(0.8 * s) }]}>
              {tree.image_type === 'fruit' ? t('card_image_fruit') : tree.image_type === 'feuille' ? t('card_image_leaf') : t('card_image_photo')}
            </Text>
          </View>
        )}
        <Text style={[styles.frontName, { fontSize: Math.round((isMini ? 11 : 19) * s), lineHeight: Math.round((isMini ? 14 : 24) * s) }]} numberOfLines={2}>
          {treeName}
        </Text>
        {!isMini && (
          <Text style={[styles.frontLatin, { fontSize: Math.round(11 * s), marginTop: Math.round(4 * s) }]} numberOfLines={1}>
            {tree.name_latin}
          </Text>
        )}
      </View>

      {/* Cadre intérieur doré décoratif */}
      {!isMini && (
        <View style={[StyleSheet.absoluteFill, {
          margin: Math.round(5 * s),
          borderRadius: r - 2,
          borderWidth: 1,
          borderColor: 'rgba(201,168,76,0.30)',
          pointerEvents: 'none',
        }]} />
      )}

      {/* Effet foil */}
      {!isMini && <FoilShimmer w={w} h={h} />}

      {/* Overlay verrouillé */}
      {locked && (
        <View style={[StyleSheet.absoluteFill, styles.lockedOverlay, { borderRadius: r }]}>
          <Text style={{ fontSize: Math.round(40 * s) }}>🔒</Text>
          <Text style={[styles.lockedLabel, { fontSize: Math.round(15 * s), marginTop: Math.round(8 * s) }]}>???</Text>
        </View>
      )}
    </Animated.View>
  );

  // ── Verso ──────────────────────────────────────────────────────────────────
  const verso = !locked ? (
    <Animated.View style={[styles.card, cardSz, styles.backCard, { borderRadius: r, padding: pad, borderWidth: Math.round(2 * s), borderColor: C.backBorder }, backAnim]}>

      {/* En-tête : titre + numéro */}
      <View style={[styles.backHeader, { marginBottom: Math.round(10 * s) }]}>
        <View style={{ flex: 1, paddingRight: Math.round(8 * s) }}>
          <Text style={[styles.backNameFr, { fontSize: Math.round((isMini ? 13 : 22) * s) }]} numberOfLines={2}>
            {treeName}
          </Text>
          <Text style={[styles.backNameLatin, { fontSize: Math.round((isMini ? 9 : 14) * s), marginTop: Math.round(3 * s) }]} numberOfLines={1}>
            {tree.name_latin}
          </Text>
        </View>
        {/* Badge numéro */}
        <View style={[styles.backNumBadge, { borderRadius: Math.round(8 * s), paddingHorizontal: Math.round(8 * s), paddingVertical: Math.round(5 * s) }]}>
          <Text style={[styles.backNumText, { fontSize: Math.round((isMini ? 9 : 13) * s) }]}>
            #{String(tree.id).padStart(3, '0')}
          </Text>
        </View>
      </View>

      {/* Séparateur doré */}
      <View style={[styles.goldSep, { marginBottom: Math.round(10 * s) }]} />

      {/* Géolocalisation */}
      <View style={[styles.geoBlock, { borderRadius: Math.round(8 * s), padding: Math.round(10 * s), marginBottom: Math.round(10 * s) }]}>
        <Text style={[styles.geoLabel, { fontSize: Math.round((isMini ? 7 : 10) * s), marginBottom: Math.round(3 * s) }]}>
          {t('card_geo_label')}
        </Text>
        <Text style={[styles.geoText, { fontSize: Math.round((isMini ? 9 : 13) * s), lineHeight: Math.round(18 * s) }]} numberOfLines={isMini ? 2 : 4}>
          {'📍 '}{treeGeo}
        </Text>
      </View>

      {/* Anecdote — prend tout l'espace restant */}
      {!isMini && (
        <View style={[styles.anecBlock, { borderRadius: Math.round(8 * s), padding: Math.round(12 * s), marginBottom: Math.round(10 * s) }]}>
          <Text style={[styles.anecLabel, { fontSize: Math.round(10 * s), marginBottom: Math.round(6 * s) }]}>
            {t('card_anec_label')}
          </Text>
          <Text style={[styles.anecText, { fontSize: Math.round(14 * s), lineHeight: Math.round(21 * s) }]}>
            {treeAnec}
          </Text>
        </View>
      )}

      {/* Footer ONF */}
      <View style={styles.backFooter}>
        <Text style={[styles.onfLabel, { fontSize: Math.round((isMini ? 7 : 10) * s) }]}>
          {t('card_onf_credit')}
        </Text>
        <View style={[styles.imageTypePill, { borderRadius: Math.round(10 * s), paddingHorizontal: Math.round(7 * s), paddingVertical: Math.round(2 * s) }]}>
          <Text style={[styles.imageTypeText, { fontSize: Math.round((isMini ? 7 : 9) * s) }]}>
            {tree.image_type === 'fruit' ? t('card_image_fruit_short') : tree.image_type === 'feuille' ? t('card_image_leaf_short') : t('card_image_photo_short')}
          </Text>
        </View>
      </View>
    </Animated.View>
  ) : null;

  return (
    <TouchableOpacity
      onPress={flip}
      activeOpacity={locked ? 1 : 0.92}
      style={cardSz}
    >
      {recto}
      {verso}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    overflow: 'hidden',
  },

  // ── Recto ──
  onfLogoWrapper: {
    position:       'absolute',
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  numBadge: {
    position:        'absolute',
    backgroundColor: 'rgba(10,20,5,0.70)',
    borderColor:     C.frameBorder,
    borderWidth:     1,
  },
  numBadgeText: {
    color:      C.numText,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  frontBottom: {
    position: 'absolute',
    left:     0,
    right:    0,
    bottom:   0,
  },
  typePill: {
    backgroundColor: 'rgba(201,168,76,0.22)',
    borderWidth:     1,
    borderColor:     'rgba(201,168,76,0.55)',
  },
  typePillText: {
    color:         C.frameBorder,
    fontWeight:    '700',
    textTransform: 'uppercase',
  },
  frontName: {
    color:      '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor:  'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  frontLatin: {
    color:     'rgba(210,190,130,0.90)',
    fontStyle: 'italic',
    fontWeight: '400',
    textShadowColor:  'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  lockedOverlay: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  lockedLabel: {
    color:      '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 2,
  },

  // ── Verso ──
  backCard: {
    backgroundColor: C.backBg,
    flexDirection:   'column',
  },
  backHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  backNameFr: {
    color:      C.darkGreen,
    fontWeight: '800',
    lineHeight: undefined,
  },
  backNameLatin: {
    color:     C.latinColor,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  backNumBadge: {
    backgroundColor: C.gold,
    alignSelf:       'flex-start',
    minWidth:        44,
    alignItems:      'center',
  },
  backNumText: {
    color:      C.darkGreen,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  goldSep: {
    height:          2,
    backgroundColor: C.gold,
    opacity:         0.6,
  },
  geoBlock: {
    backgroundColor: C.geoBg,
    borderLeftWidth: 3,
    borderLeftColor: C.geoColor,
  },
  geoLabel: {
    color:         C.geoColor,
    fontWeight:    '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  geoText: {
    color:      C.geoColor,
    fontWeight: '500',
  },
  anecBlock: {
    backgroundColor: C.anecBg,
    borderWidth:     1,
    borderColor:     C.anecBorder,
    flex:            1,
  },
  anecLabel: {
    color:         C.midGreen,
    fontWeight:    '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  anecText: {
    color:      C.anecText,
    fontWeight: '500',
  },
  backFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      'auto',
    paddingTop:     6,
  },
  onfLabel: {
    color:      C.footerText,
    fontWeight: '600',
  },
  imageTypePill: {
    backgroundColor: 'rgba(45,106,45,0.12)',
  },
  imageTypeText: {
    color:      C.midGreen,
    fontWeight: '600',
  },
});
