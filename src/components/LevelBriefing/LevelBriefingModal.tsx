// ============================================================
// LevelBriefingModal — Briefing affiché avant chaque défi Solo
//
// Pages : [intro (niveau 1)] + [une page par élément, avec toutes ses règles] + résumé.
// Les règles d'un même élément (ex. loup : pas de loup voisin + pas de mouton voisin) sont empilées sur la même page.
// La coque (en-tête, pagination, pied de page, bouton « Jouer ») est
// commune à tous les modes : voir BriefingLayout.
//
// Fermeture : tap explicite sur « Jouer » → onClose()
// onClose() dans [challengeId].tsx appelle game.startTimer()
// ============================================================

import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Challenge } from '../../core/models/Challenge';
import { LevelMeta, RuleCard as RuleCardData, groupRulesByElement } from '../../data/levelMeta';
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
  | { kind: 'rules'; rules: RuleCardData[] }
  | { kind: 'summary' };

const THEME: BriefingTheme = {
  overlay: 'rgba(26, 58, 26, 0.97)',
  accent: Colors.forest.accent,
  cta: Colors.forest.accent,
  ctaText: Colors.forest.dark,
};

/** Une page = un élément : toutes ses règles empilées (défilement si l'écran est trop petit). */
const RuleGroupPage: React.FC<{ rules: RuleCardData[]; width: number }> = ({ rules, width }) => {
  const t = useT();
  if (rules.length === 1) return <RuleCard rule={rules[0]} isNew width={width} />;
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={groupStyles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={groupStyles.badge}>
        <Text style={groupStyles.badgeText}>{t('label_new')}</Text>
      </View>
      {rules.map(rule => (
        <RuleCard
          key={rule.id}
          rule={rule}
          isNew
          compact
          width={width}
          animHeight={rule.type === 'center_only' ? 180 : 104}
        />
      ))}
    </ScrollView>
  );
};

const groupStyles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  badge: {
    backgroundColor: Colors.forest.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
});
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
    ...groupRulesByElement(levelMeta.newRules).map(rules => ({ kind: 'rules' as const, rules })),
    { kind: 'summary' as const },
  ];

  const renderPage = (item: Page) => {
    if (item.kind === 'intro') return <IntroSlide />;
    if (item.kind === 'rules') return <RuleGroupPage rules={item.rules} width={width - 32} />;
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