// ============================================================
// HerbierEntry — entrée de l'Herbier sur l'accueil (Progression v2, C6 / Lot 7)
//
// Une carte cliquable : titre, progression « X / total » et la PROCHAINE carte à découvrir en
// silhouette (on ne révèle ni son nom ni son image avant qu'elle soit plantée). Un tap ouvre l'Herbier
// (`TreeCardGallery`) sur l'onglet « Planter ».
//
// L'Herbier est accessible dès le chapitre 1 : la France est ouverte d'emblée, aucune condition.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePlayerStore } from '../../store/playerStore';
import { getCollectionProgress, getNextCard } from '../../utils/onfCards';
import { countUnseenCards, formatBadgeCount, getOpenRegions, getRegionFeature } from '../../constants/herbier';
import { isFeatureUnlocked } from '../../constants/progression';
import { isDemoAccount } from '../../constants/devAccess';
import { TreeCardGallery } from './TreeCardGallery';
import { useT } from '../../i18n';
import { RelookingAssets } from '../../theme/relookingAssets';
import { useHomeFont } from '../../theme/homeTypography';
import { ForestColors } from '../../theme/forestTheme';

export function HerbierEntry({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const fontFamily = useHomeFont();
  const displayFont = fontFamily ? { fontFamily, fontWeight: 'normal' as const } : undefined;
  const collectedIds = usePlayerStore(s => s.collectedTreeCardIds);
  const levelsCompleted = usePlayerStore(s => s.levelsCompleted);
  const username = usePlayerStore(s => s.username);
  const seenIds = usePlayerStore(s => s.seenTreeCardIds);
  const [open, setOpen] = useState(false);

  const progress = useMemo(() => getCollectionProgress(collectedIds), [collectedIds]);
  const openRegions = useMemo(
    () => getOpenRegions(r => isFeatureUnlocked(getRegionFeature(r)!, { levelsCompleted }), isDemoAccount(username)),
    [levelsCompleted, username],
  );
  const next = useMemo(() => getNextCard(collectedIds, openRegions), [collectedIds, openRegions]);
  // Cartes obtenues et pas encore vues dans la collection : badge rouge (comme sur l'onglet « Ma collection »)
  const unseenCount = countUnseenCards(collectedIds, seenIds);

  return (
    <>
      <TouchableOpacity
        style={compact ? styles.compactCard : styles.card}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          t('herbier_home_a11y', { owned: String(progress.owned), total: String(progress.total) }) +
          (unseenCount > 0 ? ', ' + t('herbier_tab_collection_a11y_new', { count: String(progress.owned), new: String(unseenCount) }) : '')
        }
      >
        {unseenCount > 0 && (
          <View style={styles.badge} pointerEvents="none" accessible={false} importantForAccessibility="no">
            <Text style={styles.badgeText}>{formatBadgeCount(unseenCount)}</Text>
          </View>
        )}
        {compact ? (
          <>
            <View style={styles.compactContent}>
              <View style={styles.compactInfo}>
                <Text style={[styles.compactTitle, displayFont]}>{t('herbier_home_title')}</Text>
                <Text style={[styles.compactProgress, displayFont]}>{t('herbier_home_progress', { owned: String(progress.owned), total: String(progress.total) })}</Text>
              </View>
              <Image source={RelookingAssets.carteHerbier} style={styles.compactImage} resizeMode="contain" />
            </View>
            <Image source={RelookingAssets.flecheGo} style={styles.compactArrow} resizeMode="contain" />
          </>
        ) : (
        <>
        {/* Prochaine carte en silhouette */}
        <View style={styles.silhouette} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={styles.silhouetteEmoji}>{next ? '🌳' : '🌟'}</Text>
          {next && <Text style={styles.silhouetteMark}>?</Text>}
        </View>

        <View style={styles.info}>
          <Text style={styles.title}>🌲 {t('herbier_home_title')}</Text>
          <Text style={styles.progress}>
            {t('herbier_home_progress', { owned: String(progress.owned), total: String(progress.total) })}
          </Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.round(progress.ratio * 100)}%` as any }]} />
          </View>
          <Text style={styles.next}>{next ? t('herbier_home_next') : t('herbier_home_complete')}</Text>
        </View>
        </>
        )}
      </TouchableOpacity>

      <TreeCardGallery visible={open} onClose={() => setOpen(false)} initialTab="plant" />
    </>
  );
}

const styles = StyleSheet.create({
  compactCard: { flex: 1, minHeight: 94, alignItems: 'center', justifyContent: 'center', gap: 2 },
  compactContent: { flexDirection: 'row', alignItems: 'center' },
  compactInfo: { flex: 1, alignItems: 'center' },
  compactTitle: { color: ForestColors.textInkPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  compactProgress: { color: ForestColors.textInkPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  compactImage: { width: 32, height: 48 },
  compactArrow: { width: 26, height: 26 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(20,45,20,0.88)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.7)',
  },
  badge: {
    position: 'absolute', top: -8, right: -4, minWidth: 22, height: 22, borderRadius: 11, zIndex: 5,
    backgroundColor: '#E53935', borderWidth: 2, borderColor: '#FFF8E7',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#FFF', lineHeight: 15 },
  silhouette: {
    width: 56,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#1A3A1A',
    borderWidth: 2,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteEmoji: { fontSize: 30, opacity: 0.4 },
  silhouetteMark: { position: 'absolute', fontSize: 24, fontWeight: '900', color: '#C9A84C' },
  info: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: '#FFF8E7' },
  progress: { fontSize: 13, fontWeight: '700', color: '#9CCC65' },
  barBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#9CCC65' },
  next: { fontSize: 11, color: 'rgba(255,248,231,0.7)' },
});
