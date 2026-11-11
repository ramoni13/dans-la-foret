// ============================================================
// DailyBriefingModal — Briefing du Défi du Jour
//
// Page 0 : règle champignon — cases centrales (center_only)
// Page 1 : règle champignon — pas de voisins (no_same_neighbor)
// Page 2 : résumé commun (BoardSummary) + rappels du Journalier
//
// La coque (en-tête, pagination, pied de page, « Jouer ») est commune
// à tous les modes : voir BriefingLayout. Accent doré propre au Journalier.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useT } from '../../i18n';
import { RuleCard } from './RuleCard';
import { BoardSummary, BriefingNotes } from './BoardSummary';
import { BriefingLayout, BriefingTheme } from './BriefingLayout';
import { Challenge } from '../../core/models/Challenge';
import { RuleCard as RuleCardData } from '../../data/levelMeta';

interface DailyBriefingModalProps {
  challenge: Challenge;
  onClose: () => void;
  /** Ligue jouée (Progression v2) : affichée dans le récapitulatif. Absente → pas de ligne de ligue. */
  league?: 'pousse' | 'grand_chene';
}

const GOLD = '#D4A017';

const THEME: BriefingTheme = {
  overlay: 'rgba(26, 58, 26, 0.97)',
  accent: GOLD,
  cta: GOLD,
  ctaText: '#1A3A1A',
};

// ── Règles champignon statiques (comme les RuleCard de levelMeta) ─────────────

const rCenterOnly: RuleCardData = {
  id: 'center_only_champignon',
  type: 'center_only',
  elements: ['champignon'],
  i18nKey: 'daily_briefing_rule_center',
};

const rNoSameChampignon: RuleCardData = {
  id: 'no_same_champignon',
  type: 'no_same_neighbor',
  elements: ['champignon', 'champignon'],
  i18nKey: 'daily_briefing_rule_no_neighbor',
};

const PAGES = [0, 1, 2];

// ── Composant ────────────────────────────────────────────────────────────────

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  league,
  challenge,
  onClose,
}) => {
  const t = useT();
  const { width } = useWindowDimensions();

  const renderPage = (item: number) => {
    if (item === 0) {
      return (
        <>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{t('daily_briefing_new_element')}</Text>
          </View>
          <RuleCard rule={rCenterOnly} isNew={false} width={width - 32} animHeight={240} />
        </>
      );
    }

    if (item === 1) {
      return <RuleCard rule={rNoSameChampignon} isNew={false} width={width - 32} />;
    }

    const leagueName = league ? t(`daily_league_${league}`) : '';
    const subtitle = league
      ? `${t('daily_briefing_board')}\n${t('daily_league_label', { league: leagueName })}`
      : t('daily_briefing_board');

    return (
      <BoardSummary
        challenge={challenge}
        title={t('daily_briefing_title')}
        subtitle={subtitle}
        accent={GOLD}
        titleColor={GOLD}
      >
        <BriefingNotes
          items={[
            { icon: '⚡', text: t('daily_briefing_single_validation') },
            { icon: '🚫', text: t('daily_briefing_no_bonus') },
            {
              icon: '🌍',
              text: league ? t(`daily_briefing_league_${league}`) : t('daily_briefing_same_challenge'),
            },
          ]}
        />
      </BoardSummary>
    );
  };

  return (
    <BriefingLayout
      title={t('daily_title')}
      theme={THEME}
      pages={PAGES}
      renderPage={renderPage}
      onClose={onClose}
    />
  );
};

const styles = StyleSheet.create({
  newBadge: {
    backgroundColor: GOLD,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  newBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A3A1A',
  },
});