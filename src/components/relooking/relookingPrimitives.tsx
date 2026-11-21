// src/components/relooking/RelookingPrimitives.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { ForestColors, ForestMetrics } from '../../theme/forestTheme';
import { RelookingAssets } from '../../theme/relookingAssets';
import { useHomeFont } from '../../theme/homeTypography';

/**
 * 1. Capsule compteur en bois (Pommes de pin ou Graines) sans bouton "+"
 */
interface WoodCounterPillProps {
  type: 'pp' | 'graines';
  value: number | string;
  onPress?: () => void;
}

export const WoodCounterPill: React.FC<WoodCounterPillProps> = ({
  type,
  value,
  onPress,
}) => {
  const fontFamily = useHomeFont();
  const source =
    type === 'pp' ? RelookingAssets.compteurPP : RelookingAssets.compteurGraines;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.counterWrapper}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value} ${type === 'pp' ? 'pommes de pin' : 'graines'}`}
    >
      <ImageBackground
        source={source}
        resizeMode="stretch"
        style={styles.counterBg}
        imageStyle={styles.fillImage}
      >
        <Text style={[styles.counterText, fontFamily && { fontFamily, fontWeight: 'normal' }]}>{value}</Text>
      </ImageBackground>
    </Pressable>
  );
};

/**
 * 2. Bouton texturé 3D (Vert forêt, Orange ambre ou Pavé papier encadré de bois)
 */
interface TexturedButtonProps {
  label: string;
  caption?: string;
  onPress: () => void;
  variant?: 'green' | 'orange' | 'paper';
  disabled?: boolean;
  style?: ViewStyle;
  fontSize?: number;
  accentText?: string;
}

export const TexturedButton: React.FC<TexturedButtonProps> = ({
  label,
  caption,
  onPress,
  variant = 'green',
  disabled = false,
  style,
  fontSize = 16,
  accentText,
}) => {
  const fontFamily = useHomeFont();
  const bgSource =
    variant === 'green'
      ? RelookingAssets.boutonVert
      : variant === 'orange'
      ? RelookingAssets.boutonOrange
      : RelookingAssets.pavePapier;

  const isLightSurface = variant === 'paper';
  const accentIndex = accentText ? label.indexOf(accentText) : -1;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.texturedBtnContainer,
        pressed && !disabled && { transform: [{ scale: 0.97 }, { translateY: 2 }] },
        disabled && { opacity: 0.5 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={caption ? `${caption} · ${label}` : label}
      accessibilityState={{ disabled }}
    >
      <ImageBackground
        source={bgSource}
        resizeMode="stretch"
        style={styles.texturedBtnBg}
        imageStyle={styles.fillImage}
      >
        {caption && (
          <Text style={[
            styles.texturedBtnLabel,
            styles.texturedBtnCaption,
            isLightSurface && styles.texturedBtnLabelDark,
            fontFamily && { fontFamily, fontWeight: 'normal' },
          ]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {caption}
          </Text>
        )}
        <Text
          style={[
            styles.texturedBtnLabel,
            isLightSurface && styles.texturedBtnLabelDark,
            { fontSize },
            fontFamily && { fontFamily, fontWeight: 'normal' },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {accentIndex >= 0 ? (
            <>
              {label.slice(0, accentIndex)}
              <Text style={styles.texturedBtnAccent}>{accentText}</Text>
              {label.slice(accentIndex + (accentText?.length ?? 0))}
            </>
          ) : label}
        </Text>
      </ImageBackground>
    </Pressable>
  );
};

/**
 * 3. Bouton carré parchemin avec icône intégrée (Indice, Vérifier, Annuler)
 */
interface ParchmentIconButtonProps {
  type: 'indice' | 'verification' | 'retour';
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  iconSize?: number;
}

export const ParchmentIconButton: React.FC<ParchmentIconButtonProps> = ({
  type,
  label,
  onPress,
  disabled = false,
  iconSize = 36,
}) => {
  const source =
    type === 'indice'
      ? RelookingAssets.indice
      : type === 'verification'
      ? RelookingAssets.verification
      : RelookingAssets.retour;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconActionBtn,
        pressed && !disabled && { transform: [{ scale: 0.95 }] },
        disabled && { opacity: 0.45 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label ?? type}
      accessibilityState={{ disabled }}
    >
      <Image
        source={source}
        style={{ width: iconSize, height: iconSize }}
        resizeMode="contain"
      />
      {label ? (
        <Text style={styles.iconActionLabel} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
};

/**
 * 4. Bandeau supérieur de l'écran Défi
 */
interface ChallengeHeaderContainerProps {
  children: React.ReactNode;
  topInset?: number;
  style?: ViewStyle;
}

export const ChallengeHeaderContainer: React.FC<ChallengeHeaderContainerProps> = ({
  children,
  topInset = 0,
  style,
}) => (
  <View
    style={[
      styles.challengeHeaderBg,
      { paddingTop: Math.max(topInset, 8) },
      style,
    ]}
  >
    {children}
  </View>
);

/**
 * 5. Bannière parchemin simple (pour la carte "Défi du Jour" du Menu)
 */
interface ParchmentBannerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ParchmentBanner: React.FC<ParchmentBannerProps> = ({
  children,
  style,
}) => (
  <ImageBackground
    source={RelookingAssets.pagePapier}
    resizeMode="stretch"
    imageStyle={styles.fillImage}
    style={[styles.parchmentBanner, style]}
  >
    {children}
  </ImageBackground>
);

/**
 * 6. Socle de case du plateau avec double codage :
 *    - case_bloquee.png (pierre carrée) si verrouillée
 *    - case_libre.png (disque bois rond) si jouable
 */
interface BoardSlotBackgroundProps {
  locked: boolean;
  highlighted?: boolean;
  size?: number;
  children?: React.ReactNode;
}

export const BoardSlotBackground: React.FC<BoardSlotBackgroundProps> = ({
  locked,
  highlighted = false,
  size = ForestMetrics.boardNodeSize,
  children,
}) => {
  const source = locked
    ? RelookingAssets.caseBloquee
    : RelookingAssets.caseLibre;

  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        highlighted && !locked && styles.slotHighlight,
      ]}
    >
      <Image
        source={source}
        style={[StyleSheet.absoluteFill, { width: size, height: size }]}
        resizeMode="contain"
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  // Android uses the absolute edges; web needs explicit dimensions.
  fillImage: Platform.OS === 'android'
    ? { width: undefined, height: undefined }
    : { width: '100%', height: '100%' },
  counterWrapper: {
    flex: 1,
    maxWidth: 165,
    height: 46,
  },
  counterBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 34,
    paddingRight: 12,
  },
  counterText: {
    color: ForestColors.textOnDark,
    fontSize: 17,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  texturedBtnContainer: {
    minHeight: ForestMetrics.minTouchTarget,
    justifyContent: 'center',
  },
  texturedBtnBg: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texturedBtnLabel: {
    color: ForestColors.textOnDark,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  texturedBtnLabelDark: {
    color: ForestColors.textInkPrimary,
    textShadowColor: 'transparent',
  },
  texturedBtnCaption: {
    fontSize: 13,
  },
  texturedBtnAccent: {
    color: '#F6CB68',
  },
  iconActionBtn: {
    minWidth: ForestMetrics.minTouchTarget,
    minHeight: ForestMetrics.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  iconActionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: ForestColors.textInkPrimary,
  },
  challengeHeaderBg: {
    width: '100%',
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: ForestColors.parchmentBase,
    borderBottomWidth: 3,
    borderBottomColor: '#734B2C',
    zIndex: 1,
  },
  parchmentBanner: {
    width: '100%',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  slotHighlight: {
    shadowColor: ForestColors.goldHighlight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 6,
  },
});