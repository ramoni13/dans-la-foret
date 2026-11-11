// ============================================================
// LevelBriefingModal — Briefing affiché avant chaque défi Solo
//
// Pages : [intro (niveau 1)] + [une RuleCard par nouvelle règle] + résumé.
// La coque (en-tête, pagination, pied de page, bouton « Jouer ») est
// commune à tous les modes : voir BriefingLayout.
//
// Fermeture : tap explicite sur « Jouer » → onClose()
// onClose() dans [challengeId].tsx appelle game.startTimer()
// ============================================================

import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Challenge } from '../../core/models/Challenge';
import { LevelMeta } from '../../data/levelMeta';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { RuleCard } from './RuleCard';
import { BoardSummary } from './BoardSummary';
import { IntroSlide } from './IntroSlide';
import { BriefingLayout, BriefingTheme } from './BriefingLayout';

interface LevelBriefingModalProps {
  challenge: Challenge;
  levelMeta: LevelMeta;
  onClose: () => void;
}

type Page =
  | { kind: 'intro' }
  | { kind: 'rule'; index: number }
  | { kind: 'summary' };

const THEME: BriefingTheme = {
  overlay: 'rgba(26, 58, 26, 0.97)',
  accent: Colors.forest.accent,
  cta: Colors.forest.accent,
  ctaText: Colors.forest.dark,
};

export const LevelBriefingModal: React.FC<LevelBriefingModalProps> = ({
  challenge,
  levelMeta,
  onClose,
}) => {
  const t = useT();
  const { width } = useWindowDimensions();

  const isExpertMode = challenge.level === 'niveau_15';
  const isFirstLevel = levelMeta.levelNumber === 1;

  const pages: Page[] = [
    ...(isFirstLevel ? [{ kind: 'intro' as const }] : []),
    ...levelMeta.newRules.map((_, i) => ({ kind: 'rule' as const, index: i })),
    { kind: 'summary' as const },
  ];

  const renderPage = (item: Page) => {
    if (item.kind === 'intro') return <IntroSlide />;
    if (item.kind === 'rule') {
      return <RuleCard rule={levelMeta.newRules[item.index]} isNew width={width - 32} />;
    }
    return <BoardSummary challenge={challenge} isExpertMode={isExpertMode} />;
  };

  return (
    <BriefingLayout
      title={`${t('level_prefix')} ${levelMeta.levelNumber}`}
      theme={THEME}
      pages={pages}
      renderPage={renderPage}
      onClose={onClose}
    />
  );
};