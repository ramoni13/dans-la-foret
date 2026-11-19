import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VictoryModal } from '../src/components/Game/VictoryModal';

jest.mock('react-native', () => {
  const React = require('react');
  type MockStyle = { opacity?: number; transform?: { scale?: number }[] };
  type MockProps = {
    children?: React.ReactNode;
    style?: MockStyle | MockStyle[];
    onPress?: () => void;
  };
  const element = (tag: string) => ({ children, style, onPress }: MockProps) => {
    const styles = [style].flat().filter((s): s is MockStyle => !!s);
    const invisible = styles.some(s =>
      s.opacity === 0 || s.transform?.some(t => t.scale === 0),
    );
    return React.createElement(tag, {
      'data-invisible': invisible || undefined,
      onClick: onPress,
    }, children);
  };
  return {
    View: element('div'),
    Text: element('span'),
    TouchableOpacity: element('button'),
    TouchableWithoutFeedback: element('div'),
    StyleSheet: { create: (styles: object) => styles, absoluteFill: {} },
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { out: jest.fn(), quad: jest.fn() },
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (fn: () => object) => fn(),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    withDelay: jest.fn(),
    withSequence: jest.fn(),
    withSpring: jest.fn(),
    withTiming: jest.fn(),
  };
});

jest.mock('../src/store/playerStore', () => ({
  usePlayerStore: (selector: (state: object) => unknown) => selector({ seeds: 20, language: 'fr' }),
}));
jest.mock('../src/i18n', () => ({ useT: () => (key: string) => key }));
jest.mock('../src/utils/haptics', () => ({ notificationSuccess: jest.fn() }));
jest.mock('../src/components/Game/Confetti', () => ({ Confetti: () => null }));
jest.mock('../src/components/Game/RewardFly', () => ({
  RewardFly: () => null,
  useCounterPulse: () => ({ haloStyle: {}, counterStyle: {}, pulse: jest.fn() }),
}));
jest.mock('../src/components/Game/StarRow', () => ({ StarRow: () => null }));
jest.mock('../src/components/Game/PineconeIcon', () => ({
  PineconeIcon: () => null,
  PineconeText: () => null,
}));
jest.mock('../src/components/Badges/BadgeToast', () => ({
  BadgeToast: () => React.createElement('span', null, 'badge popup'),
}));

describe('VictoryModal with a badge popup', () => {
  const props = {
    visible: true,
    elapsedTime: 5000,
    seedsEarned: 5,
    difficulty: 'niveau_1' as const,
    challengeNumber: 1,
    onNextChallenge: jest.fn(),
    onBackToMenu: jest.fn(),
    onBadgeQueueEmpty: jest.fn(),
  };

  it('keeps victory information and actions visible when a badge appears and is dismissed', () => {
    for (const badgeQueue of [[], ['regularite_lune'], []]) {
      const html = renderToStaticMarkup(React.createElement(VictoryModal, { ...props, badgeQueue }));
      expect(html).toContain('victory_title');
      expect(html).toContain('victory_next_challenge');
      expect(html).toContain('victory_back_menu');
      expect(html).not.toContain('data-invisible');
      expect(html.includes('badge popup')).toBe(badgeQueue.length > 0);
    }
  });
});
