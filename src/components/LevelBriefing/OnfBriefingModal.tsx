// ============================================================
// OnfBriefingModal — Briefing affiché avant le premier défi ONF
//
// Structure des slides :
//  0 : Intro — "Grille Forestière" (concept sudoku forestier)
//  1..N : Règles de base des éléments présents dans le défi
//         (réutilise les RuleCard du système de briefing existant)
//  N+1 : Règle sudoku — 1 élément max par ligne ET par colonne
//  N+2 : Récap — éléments du défi + rappel des règles ONF
//
// N'est affiché qu'une seule fois (hasSeenOnfBriefing dans playerStore).
// ============================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { ElementChips } from './ElementChips';
import { RuleCard } from './RuleCard';
import { Challenge } from '../../core/models/Challenge';
import { RuleCard as RuleCardData } from '../../data/levelMeta';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { ELEMENT_SPRITES } from './RuleAnimations/sprites';

// ── Couleur thème ONF (vert forêt) ───────────────────────────────────────────
const ONF_GREEN = '#2E7D32';
const ONF_GREEN_LIGHT = '#4CAF50';

// ── Règles de base par élément (pour les slides de règles) ───────────────────
// Mapping elementId → règles RuleCard à afficher dans le briefing ONF.
// On exclut les règles très complexes (chien, chain avancée) pour garder
// la lisibilité et ne garder que les règles de voisinage essentielles.

const ONF_ELEMENT_RULES: Record<string, RuleCardData[]> = {
  bucheron: [
    {
      id: 'no_same_bucheron',
      type: 'no_same_neighbor',
      elements: ['bucheron', 'bucheron'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'bucheron' },
    },
  ],
  ours: [
    {
      id: 'no_same_ours',
      type: 'no_same_neighbor',
      elements: ['ours', 'ours'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'ours' },
    },
  ],
  mouton: [
    {
      id: 'no_same_mouton',
      type: 'no_same_neighbor',
      elements: ['mouton', 'mouton'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'mouton' },
    },
  ],
  loup: [
    {
      id: 'no_same_loup',
      type: 'no_same_neighbor',
      elements: ['loup', 'loup'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'loup' },
    },
    {
      id: 'forbid_loup_mouton',
      type: 'forbid_neighbor',
      elements: ['loup', 'mouton'],
      i18nKey: 'a11y_forbid_neighbor',
      i18nVars: { e1: 'loup', e2: 'mouton' },
    },
  ],
  ruche: [
    {
      id: 'singleton_ruche',
      type: 'singleton',
      elements: ['ruche'],
      i18nKey: 'a11y_singleton',
      i18nVars: { element: 'ruche' },
    },
    {
      id: 'require_ours_ruche',
      type: 'require_neighbor',
      elements: ['ours', 'ruche'],
      i18nKey: 'a11y_require_neighbor',
      i18nVars: { e1: 'ours', e2: 'ruche' },
    },
  ],
  cerf: [
    {
      id: 'no_same_cerf',
      type: 'no_same_neighbor',
      elements: ['cerf', 'cerf'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'cerf' },
    },
    {
      id: 'paired_cerf_biche',
      type: 'paired',
      elements: ['cerf', 'biche'],
      i18nKey: 'a11y_paired',
      i18nVars: { e1: 'cerf', e2: 'biche' },
    },
  ],
  biche: [
    {
      id: 'no_same_biche',
      type: 'no_same_neighbor',
      elements: ['biche', 'biche'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'biche' },
    },
    // paired_cerf_biche déjà affiché côté cerf, pas besoin de doublon
  ],
  tas_buches: [
    {
      id: 'chain_tas_buches',
      type: 'chain',
      elements: ['bucheron', 'tas_buches'],
      i18nKey: 'a11y_chain',
      i18nVars: { e1: 'tas_buches', e2: 'bucheron' },
    },
  ],
  chalet: [
    {
      id: 'no_same_chalet',
      type: 'no_same_neighbor',
      elements: ['chalet', 'chalet'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'chalet' },
    },
    {
      id: 'require_chalet_bucheron',
      type: 'require_neighbor',
      elements: ['chalet', 'bucheron'],
      i18nKey: 'a11y_require_neighbor',
      i18nVars: { e1: 'chalet', e2: 'bucheron' },
    },
  ],
  champignon: [
    {
      id: 'center_only_champignon',
      type: 'center_only',
      elements: ['champignon'],
      i18nKey: 'a11y_center_only',
      i18nVars: { element: 'champignon' },
    },
    {
      id: 'no_same_champignon',
      type: 'no_same_neighbor',
      elements: ['champignon', 'champignon'],
      i18nKey: 'a11y_no_same',
      i18nVars: { element: 'champignon' },
    },
  ],
};

// ── Ordre d'affichage des éléments dans les slides ───────────────────────────
const ELEMENT_DISPLAY_ORDER = [
  'bucheron', 'ours', 'mouton', 'loup',
  'ruche', 'cerf', 'biche', 'tas_buches', 'chalet', 'champignon',
];

// ── Slide illustrant la règle sudoku (mini-grille) ───────────────────────────

// Éléments fixes sans contrainte de position pour illustrer la règle sudoku.
// On utilise bucheron / ours / mouton / biche — 4 éléments simples avec
// uniquement des règles de voisinage, jamais de contrainte de placement.
const SUDOKU_EXAMPLE_ELEMENTS = ['bucheron', 'ours', 'mouton', 'biche'] as const;

// Grille 4×4 complète illustrant la contrainte ligne+colonne :
// Chacun des 4 éléments apparaît exactement 1 fois par ligne ET par colonne
// (comme dans un Sudoku 4×4).
//   [A] [B] [C] [D]   ← ligne 0 surlignée en orange
//   [C] [D] [A] [B]
//   [D] [C] [B] [A]
//   [B] [A] [D] [C]
// Colonne 0 surlignée en bleu → contient A, C, D, B (tous différents)
const SUDOKU_GRID = [
  [0, 1, 2, 3],   // A B C D
  [2, 3, 0, 1],   // C D A B
  [3, 2, 1, 0],   // D C B A
  [1, 0, 3, 2],   // B A D C
] as const;

const SudokuSlide: React.FC = () => {
  const t = useT();
  const CELL = 46;

  return (
    <View style={sudokuStyles.container}>
      <Text style={sudokuStyles.title}>{t('onf_briefing_sudoku_title')}</Text>

      {/* Grille 4×4 illustrative */}
      <View style={sudokuStyles.gridWrapper}>
        {/* Indicateur de colonne (au-dessus de la colonne 0) */}
        <View style={sudokuStyles.colIndicatorRow}>
          <View style={{ width: CELL }} />
          <View style={[sudokuStyles.colIndicatorCell, { width: CELL }]}>
            <Text style={sudokuStyles.colIndicatorText}>↓</Text>
          </View>
          <View style={{ width: CELL }} />
          <View style={{ width: CELL }} />
          <View style={{ width: CELL }} />
        </View>

        {SUDOKU_GRID.map((row, rowIdx) => (
          <View key={rowIdx} style={sudokuStyles.row}>
            {/* Indicateur de ligne (à gauche de la ligne 0) */}
            <View style={sudokuStyles.rowIndicatorCell}>
              {rowIdx === 0 && (
                <Text style={sudokuStyles.rowIndicatorText}>→</Text>
              )}
            </View>
            {row.map((elIdx, colIdx) => {
              const elId = SUDOKU_EXAMPLE_ELEMENTS[elIdx];
              const def = ElementRegistry[elId];
              const isHighlightedRow = rowIdx === 0;
              const isHighlightedCol = colIdx === 0;
              return (
                <View
                  key={colIdx}
                  style={[
                    sudokuStyles.cell,
                    { width: CELL, height: CELL },
                    isHighlightedRow && sudokuStyles.cellHighlightRow,
                    isHighlightedCol && sudokuStyles.cellHighlightCol,
                    isHighlightedRow && isHighlightedCol && sudokuStyles.cellHighlightCorner,
                  ]}
                >
                  {def && (
                    <Image
                      source={ELEMENT_SPRITES[elId] ?? def.icon}
                      style={{ width: CELL * 0.65, height: CELL * 0.65 }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Légende */}
      <View style={sudokuStyles.legendBox}>
        <View style={sudokuStyles.legendRow}>
          <View style={[sudokuStyles.legendDot, { backgroundColor: '#FF8F00' }]} />
          <Text style={sudokuStyles.legendText}>{t('onf_briefing_sudoku_row')}</Text>
        </View>
        <View style={sudokuStyles.legendRow}>
          <View style={[sudokuStyles.legendDot, { backgroundColor: '#1565C0' }]} />
          <Text style={sudokuStyles.legendText}>{t('onf_briefing_sudoku_col')}</Text>
        </View>
      </View>
    </View>
  );
};

const sudokuStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: ONF_GREEN_LIGHT,
    textAlign: 'center',
  },
  gridWrapper: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    gap: 2,
  },
  // Rangée d'indicateurs au-dessus des colonnes
  colIndicatorRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    marginBottom: 2,
  },
  colIndicatorCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  colIndicatorText: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  // Cellule d'indicateur à gauche de chaque ligne
  rowIndicatorCell: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIndicatorText: {
    fontSize: 14,
    color: '#FF8F00',
    fontWeight: '800',
  },
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cellHighlightRow: {
    backgroundColor: 'rgba(255,143,0,0.30)',
    borderColor: '#FF8F00',
  },
  cellHighlightCol: {
    backgroundColor: 'rgba(21,101,192,0.30)',
    borderColor: '#1565C0',
  },
  cellHighlightCorner: {
    backgroundColor: 'rgba(130,70,200,0.40)',
    borderColor: '#9C27B0',
  },
  legendBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    width: '100%',
    maxWidth: 300,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  legendText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
});

// ── Slide intro ONF ───────────────────────────────────────────────────────────

const OnfIntroSlide: React.FC = () => {
  const t = useT();
  return (
    <View style={introStyles.container}>
      <Text style={introStyles.emoji}>🌲</Text>
      <Text style={introStyles.title}>{t('onf_briefing_intro_title')}</Text>
      <Text style={introStyles.subtitle}>{t('onf_briefing_intro_subtitle')}</Text>

      <View style={introStyles.rulesBox}>
        <View style={introStyles.ruleRow}>
          <Text style={introStyles.ruleIcon}>🎯</Text>
          <Text style={introStyles.ruleText}>{t('onf_briefing_intro_rule1')}</Text>
        </View>
        <View style={introStyles.ruleRow}>
          <Text style={introStyles.ruleIcon}>📊</Text>
          <Text style={introStyles.ruleText}>{t('onf_briefing_intro_rule2')}</Text>
        </View>
        <View style={introStyles.ruleRow}>
          <Text style={introStyles.ruleIcon}>🐾</Text>
          <Text style={introStyles.ruleText}>{t('onf_briefing_intro_rule3')}</Text>
        </View>
      </View>
    </View>
  );
};

const introStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: ONF_GREEN_LIGHT,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  rulesBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ruleIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  ruleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 20,
  },
});

// ── Slide récap final ─────────────────────────────────────────────────────────

interface RecapSlideProps {
  elementIds: string[];
}

const RecapSlide: React.FC<RecapSlideProps> = ({ elementIds }) => {
  const t = useT();
  return (
    <ScrollView
      contentContainerStyle={recapStyles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={recapStyles.title}>{t('onf_briefing_recap_title')}</Text>
      <Text style={recapStyles.subtitle}>{t('onf_briefing_recap_subtitle')}</Text>

      <Text style={recapStyles.sectionLabel}>{t('onf_briefing_recap_elements')}</Text>
      <ElementChips elementIds={elementIds} size={40} style={recapStyles.chips} />

      <View style={recapStyles.remindersBox}>
        <View style={recapStyles.reminderRow}>
          <Text style={recapStyles.reminderIcon}>🐾</Text>
          <Text style={recapStyles.reminderText}>{t('onf_briefing_recap_forest_rules')}</Text>
        </View>
        <View style={recapStyles.reminderRow}>
          <Text style={recapStyles.reminderIcon}>📊</Text>
          <Text style={recapStyles.reminderText}>{t('onf_briefing_recap_sudoku_rule')}</Text>
        </View>
        <View style={recapStyles.reminderRow}>
          <Text style={recapStyles.reminderIcon}>✅</Text>
          <Text style={recapStyles.reminderText}>{t('onf_briefing_recap_validate')}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const recapStyles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: ONF_GREEN_LIGHT,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chips: {
    paddingHorizontal: 8,
  },
  remindersBox: {
    gap: 12,
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reminderIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  reminderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 20,
  },
});

// ── Types de pages ────────────────────────────────────────────────────────────

type PageKind =
  | { kind: 'intro' }
  | { kind: 'rule'; elementId: string; ruleIndex: number; rule: RuleCardData }
  | { kind: 'sudoku' }
  | { kind: 'recap' };

// ── Composant principal ───────────────────────────────────────────────────────

interface OnfBriefingModalProps {
  challenge: Challenge;
  onClose: () => void;
}

export const OnfBriefingModal: React.FC<OnfBriefingModalProps> = ({
  challenge,
  onClose,
}) => {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Éléments présents dans le défi (uniques)
  const elementIds = useMemo(() => {
    const ids = new Set<string>();
    challenge.availableTokens.forEach(tok => ids.add(tok.elementId));
    challenge.fixedPlacements.forEach(fp => ids.add(fp.elementId));
    return Array.from(ids);
  }, [challenge]);

  // Construction des pages
  const pages: PageKind[] = useMemo(() => {
    const result: PageKind[] = [{ kind: 'intro' }];

    // Règles des éléments présents dans le défi, dans l'ordre d'affichage
    // On déduplique les règles par ID pour éviter les répétitions (ex: paired_cerf_biche)
    const seenRuleIds = new Set<string>();

    for (const elementId of ELEMENT_DISPLAY_ORDER) {
      if (!elementIds.includes(elementId)) continue;
      const rules = ONF_ELEMENT_RULES[elementId] ?? [];
      rules.forEach((rule, ruleIndex) => {
        if (!seenRuleIds.has(rule.id)) {
          seenRuleIds.add(rule.id);
          result.push({ kind: 'rule', elementId, ruleIndex, rule });
        }
      });
    }

    result.push({ kind: 'sudoku' });
    result.push({ kind: 'recap' });
    return result;
  }, [elementIds]);

  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages - 1;

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(Math.min(Math.max(page, 0), totalPages - 1));
  }, [totalPages, SCREEN_WIDTH]);

  const goNext = useCallback(() => {
    if (isLastPage) {
      onClose();
    } else {
      const next = currentPage + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentPage(next);
    }
  }, [isLastPage, currentPage, onClose]);

  const renderPage = ({ item }: { item: PageKind }) => {
    if (item.kind === 'intro') {
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <OnfIntroSlide />
        </View>
      );
    }

    if (item.kind === 'rule') {
      const def = ElementRegistry[item.elementId];
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          {/* Badge avec nom de l'élément */}
          {item.ruleIndex === 0 && def && (
            <View style={styles.elementBadgeRow}>
              <Image
                source={ELEMENT_SPRITES[item.elementId] ?? def.icon}
                style={styles.elementBadgeIcon}
                resizeMode="contain"
              />
              <Text style={styles.elementBadgeName}>{t(`rules_element_${item.elementId}`)}</Text>
            </View>
          )}
          <RuleCard
            rule={item.rule}
            isNew={false}
            width={SCREEN_WIDTH - 32}
          />
        </View>
      );
    }

    if (item.kind === 'sudoku') {
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.newBadgeRow}>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('onf_briefing_new_rule')}</Text>
            </View>
          </View>
          <SudokuSlide />
        </View>
      );
    }

    // Récap
    return (
      <View style={[styles.page, { width: SCREEN_WIDTH }]}>
        <RecapSlide elementIds={elementIds} />
      </View>
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('onf_briefing_header_title')}</Text>
          <View style={styles.headerRight}>
            {/* Dots de pagination */}
            <View style={styles.dots}>
              {pages.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentPage && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            {/* Bouton fermer */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Fermer"
            >
              <Text style={styles.closeBtnText}>{'×'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Séparateur ── */}
        <View style={styles.divider} />

        {/* ── Contenu paginé ── */}
        <View style={styles.content}>
          <FlatList
            ref={flatListRef}
            data={pages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderPage}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            snapToInterval={SCREEN_WIDTH}
            decelerationRate="fast"
            bounces={false}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />
        </View>

        {/* ── Séparateur ── */}
        <View style={styles.divider} />

        {/* ── Footer ── */}
        <View style={styles.footer}>
          {!isLastPage && (
            <Text style={styles.swipeHint}>
              {'← '}{t('onf_briefing_swipe_hint')}{' →'}
            </Text>
          )}

          {isLastPage && (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.playBtnText}>{t('btn_play')} {'▶'}</Text>
            </TouchableOpacity>
          )}

          {!isLastPage && (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={goNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>{'→'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 36, 11, 0.97)',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ONF_GREEN_LIGHT,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: 140,
    justifyContent: 'flex-end',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: ONF_GREEN_LIGHT,
    width: 12,
    borderRadius: 3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  // Badge élément
  elementBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  elementBadgeIcon: {
    width: 28,
    height: 28,
  },
  elementBadgeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Badge "Nouvelle règle"
  newBadgeRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  newBadge: {
    backgroundColor: ONF_GREEN,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ONF_GREEN_LIGHT,
  },
  newBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  swipeHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
  playBtn: {
    flex: 1,
    backgroundColor: ONF_GREEN,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ONF_GREEN_LIGHT,
  },
  playBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  nextBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  nextBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
