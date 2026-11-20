import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { subscribeForetCommune, addForetCommunePoints } from '../../services/foretCommuneService';
import { FORET_COMMUNE_POINTS_PER_VIDEO, FORET_COMMUNE_POINTS_PER_TREE } from '../../constants/foretCommune';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { useT } from '../../i18n';
import { TexturedButton } from '../relooking/relookingPrimitives';
import { useHomeFont } from '../../theme/homeTypography';

const MACARON_CS = require('../../../assets/elements/design_app/Macaron CS.png');

export function ForetCommuneWidget() {
  const t = useT();
  const fontFamily = useHomeFont();
  const { width } = useWindowDimensions();
  const displayFont = fontFamily ? { fontFamily, fontWeight: 'normal' as const } : undefined;
  const [cagnottePoints, setCagnottePoints] = useState(0);
  const [totalTrees, setTotalTrees] = useState(0);
  const [contributing, setContributing] = useState(false);

  useEffect(() => {
    const unsub = subscribeForetCommune(({ cagnottePoints: pts, totalTrees: trees }) => {
      setCagnottePoints(pts);
      setTotalTrees(trees);
    });
    return () => unsub();
  }, []);

  const foretAd = useRewardedAd('foret_commune');
  const handlePub = async () => {
    if (contributing || !foretAd.available) return;
    setContributing(true);
    try {
      if (await foretAd.watch()) {
        await addForetCommunePoints(FORET_COMMUNE_POINTS_PER_VIDEO);
      }
    } catch (error) {
      console.warn('[ForetCommuneWidget] Contribution impossible', error);
    } finally {
      setContributing(false);
    }
  };

  const treesLabel = totalTrees === 0
    ? t('foret_commune_zero')
    : totalTrees === 1
      ? t('foret_commune_one')
      : t('foret_commune_other', { count: String(totalTrees) });
  const progressPct = Math.min(cagnottePoints / FORET_COMMUNE_POINTS_PER_TREE, 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.left}>
        <View
          style={styles.pointer}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Svg width="100%" height="100%" viewBox="0 0 12 100" preserveAspectRatio="none">
            <Path d="M0 0 L12 50 L0 100 Z" fill="#285235" />
            <Path d="M0 0 L12 50 L0 100" fill="none" stroke="#C4AE85" strokeWidth={1} />
          </Svg>
        </View>
        <View style={styles.header}>
          <Image source={MACARON_CS} style={[styles.logo, width < 360 && styles.logoCompact]} resizeMode="contain" />
          <View style={styles.headerText}>
            <Text style={[styles.brand, width < 360 && styles.brandCompact, displayFont]} numberOfLines={1} adjustsFontSizeToFit>PLANÈTE URGENCE</Text>
            <Text style={[styles.trees, displayFont]} numberOfLines={2}>{t('foret_commune_counter', { label: treesLabel })}</Text>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.round(progressPct * 100)}%` }]} />
        </View>
        <Text style={[styles.progressLabel, displayFont]} numberOfLines={1}>
          {t('foret_commune_progress', { current: cagnottePoints.toLocaleString(), total: FORET_COMMUNE_POINTS_PER_TREE.toLocaleString() })}
        </Text>
      </View>
      <View style={styles.right}>
        <TexturedButton variant="orange" label={t('foret_commune_contribute')} onPress={handlePub} disabled={contributing || !foretAd.available} fontSize={13} />
        <Text style={styles.sub}>{contributing ? '...' : foretAd.remaining <= 0 ? t('foret_commune_ad_limit') : t('foret_commune_watch_ad')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: '#F4ECD8', borderColor: '#C4AE85', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  left: { flex: 3, backgroundColor: '#285235', padding: 10, justifyContent: 'center', zIndex: 1 },
  pointer: { position: 'absolute', right: -12, top: 0, width: 12, height: '100%' },
  right: { flex: 2, padding: 6, paddingLeft: 16, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 44, height: 44 },
  logoCompact: { width: 40, height: 40 },
  headerText: { flex: 1 },
  brand: { color: '#FFF8E7', fontSize: 14, fontWeight: '800' },
  brandCompact: { fontSize: 11 },
  trees: { color: '#F3CA72', fontSize: 12, fontWeight: '800' },
  sub: { color: '#594230', fontSize: 9, textAlign: 'center' },
  progressBarBg: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressBarFill: { height: 4, backgroundColor: '#8BC34A', borderRadius: 2 },
  progressLabel: { color: '#F3CA72', fontSize: 10, fontWeight: '600', marginTop: 3 },
});
