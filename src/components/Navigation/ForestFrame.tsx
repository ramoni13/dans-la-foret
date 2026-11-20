import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import ReAnimated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { usePlayerStore } from '../../store/playerStore';
import { useAudioStore } from '../../store/audioStore';
import { useRewardFlyStore } from '../../store/rewardFlyStore';
import { useNavStore } from '../../store/navStore';
import { countTotalStars } from '../../constants/progression';
import { hasNewBadge } from '../../constants/ceremonies';
import { PROGRESSION_V2 } from '../../constants/featureFlags';
import { BTN_X_CENTERS, getMenuLayout } from '../../constants/frameLayout';
import { useT } from '../../i18n';
import { WoodCounterPill } from '../relooking/relookingPrimitives';

const MENU_IMG = require('../../../assets/cadre/menu_bas.png');

const BUTTONS = [
  { key: 'index', xC: BTN_X_CENTERS[0], route: '/(tabs)/', label: 'nav_home' },
  { key: 'rules', xC: BTN_X_CENTERS[1], route: '/(tabs)/rules', label: 'nav_rules' },
  { key: 'challenge', xC: BTN_X_CENTERS[2], route: '/(tabs)/challenge', label: 'nav_friends' },
  { key: 'profile', xC: BTN_X_CENTERS[3], route: '/(tabs)/profile', label: 'nav_profile' },
] as const;

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

export default function ForestFrame() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const activeTab = segments.includes('rules') ? 'rules'
    : segments.includes('challenge') ? 'challenge'
    : segments.includes('profile') ? 'profile' : 'index';
  const t = useT();
  const seeds = usePlayerStore(s => s.seeds);
  const challengeStars = usePlayerStore(s => s.challengeStars);
  const stars = React.useMemo(() => countTotalStars(challengeStars), [challengeStars]);
  const duelIsNew = usePlayerStore(s => hasNewBadge('duel', s.newFeatureBadges));
  const { hideBack, onBack, backLabel, pendingFriendChallenges } = useNavStore();
  const menuEnabled = useAudioStore(s => s.menuEnabled);
  const setMenu = useAudioStore(s => s.setMenuEnabled);
  const setCounterPosition = useRewardFlyStore(s => s.setCounterPosition);
  const starsPulse = usePulseOnReward('stars');
  const seedsPulse = usePulseOnReward('seeds');
  const { menuWidth, menuHeight, menuLeft, menuBottom } = getMenuLayout(width, insets.top, insets.bottom);
  const counterWidth = Math.min(165, (width - 48) / 2);

  React.useEffect(() => {
    setCounterPosition('stars', width / 2 - 8 - counterWidth / 2, insets.top + 31);
    setCounterPosition('seeds', width / 2 + 8 + counterWidth / 2, insets.top + 31);
  }, [width, insets.top, counterWidth, setCounterPosition]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.counters, { top: insets.top + 8 }]} pointerEvents="none">
        {PROGRESSION_V2 && (
          <ReAnimated.View style={[styles.counter, starsPulse]}>
            <WoodCounterPill type="pp" value={stars} />
          </ReAnimated.View>
        )}
        <ReAnimated.View style={[styles.counter, seedsPulse]}>
          <WoodCounterPill type="graines" value={seeds} />
        </ReAnimated.View>
      </View>
      {onBack && (
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 58 }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('forest_frame_back_label')}
        >
          <Text style={styles.backText}>{backLabel ?? t('forest_frame_back')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.soundButton, { top: insets.top + 58 }]}
        onPress={() => setMenu(!menuEnabled)}
        accessibilityRole="button"
        accessibilityLabel={menuEnabled ? t('forest_frame_mute') : t('forest_frame_unmute')}
      >
        <Text style={styles.soundIcon}>{menuEnabled ? '🔊' : '🔇'}</Text>
      </TouchableOpacity>
      <Image source={MENU_IMG} resizeMode="stretch" style={{ position: 'absolute', left: menuLeft, bottom: menuBottom, width: menuWidth, height: menuHeight }} />
      {BUTTONS.map(btn => {
        const x = menuLeft + btn.xC * menuWidth;
        const y = height - menuBottom - menuHeight / 2;
        const size = Math.max(48, menuHeight * 0.65);
        const isActive = btn.key === activeTab;
        return (
          <View key={btn.key} pointerEvents="box-none" style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size }}>
            {isActive && <View pointerEvents="none" style={styles.active} />}
            {btn.key === 'challenge' && duelIsNew && (
              <View pointerEvents="none" style={styles.newDot} accessible={false} importantForAccessibility="no">
                <Text style={styles.newDotText}>✦</Text>
              </View>
            )}
            {btn.key === 'challenge' && pendingFriendChallenges > 0 && (
              <View pointerEvents="none" style={styles.badgeWrapper}>
                <View style={styles.badge}><Text style={styles.badgeText}>{pendingFriendChallenges > 9 ? '9+' : pendingFriendChallenges}</Text></View>
              </View>
            )}
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (isActive && onBack) onBack();
                else {
                  if (btn.key !== 'profile') hideBack();
                  router.push(btn.route);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={btn.key === 'challenge' && duelIsNew
                ? `${t(btn.label)}, ${t('ceremony_new_badge_a11y')}`
                : t(btn.label)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  counters: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'center', gap: 16 },
  counter: { flex: 1, maxWidth: 165, height: 46 },
  active: { ...StyleSheet.absoluteFill, borderRadius: 999, borderWidth: 3, borderColor: '#FFD166', backgroundColor: 'rgba(255,209,102,0.12)' },
  backButton: { position: 'absolute', left: 12, minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 18, backgroundColor: '#5C3010', borderWidth: 2, borderColor: '#3B1E08' },
  backText: { color: '#FFF8E7', fontSize: 13, fontWeight: '700' },
  soundButton: { position: 'absolute', right: 0, width: 36, height: 36, borderRadius: 20, backgroundColor: '#5C3010', borderWidth: 2, borderColor: '#3B1E08', alignItems: 'center', justifyContent: 'center' },
  soundIcon: { fontSize: 20 },
  badgeWrapper: { position: 'absolute', top: 0, right: 0 },
  badge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E53935', borderWidth: 1.5, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', lineHeight: 12 },
  newDot: { position: 'absolute', top: 0, left: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#FFC107', borderWidth: 1.5, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  newDotText: { fontSize: 9, fontWeight: '900', color: '#3E2F00', lineHeight: 12 },
});
