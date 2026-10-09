// ============================================================
// ECRAN REGLES
// Affiche tous les elements dans l'ordre d'apparition.
// Elements debloques : icone + nom + animations des regles (memes que le briefing).
// Elements verrouilles : icone grisee + nom uniquement.
// ============================================================

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../src/constants/colors';
import { FRAME_BOTTOM_FRACTION, useFrameLayout } from '../../src/constants/frameLayout';
import { usePlayerStore } from '../../src/store/playerStore';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import { useT } from '../../src/i18n';
import { LEVEL_META, RuleCard as RuleCardData } from '../../src/data/levelMeta';
import { RuleCard as RuleCardComponent } from '../../src/components/LevelBriefing/RuleCard';
import { IntroSlide } from '../../src/components/LevelBriefing/IntroSlide';

// RULE_CARD_WIDTH est calculé dynamiquement dans le composant (voir useFrameLayout)

const BG_IMAGE = require('../../assets/elements/sprites/fond-ecran.jpg');

function BgImage() {
  const { width, height } = useWindowDimensions();
  return (
    <>
      <Image
        source={BG_IMAGE}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)' }]} pointerEvents="none" />
    </>
  );
}

// ── Ordre d'apparition + mapping explicite des regles ───────────────────────
interface ElementEntry {
  id: string;
  introLevel: number;
  nameKey: string;
  /** IDs des RuleCards a afficher pour cet element */
  ruleIds: string[];
}

const ELEMENT_ORDER: ElementEntry[] = [
  { id: 'bucheron',   introLevel: 1,  nameKey: 'rules_element_bucheron',   ruleIds: ['no_same_bucheron'] },
  { id: 'ours',       introLevel: 1,  nameKey: 'rules_element_ours',       ruleIds: ['no_same_ours'] },
  { id: 'mouton',     introLevel: 1,  nameKey: 'rules_element_mouton',     ruleIds: ['no_same_mouton'] },
  { id: 'chien',      introLevel: 3,  nameKey: 'rules_element_chien',      ruleIds: ['connected_chien'] },
  { id: 'loup',       introLevel: 5,  nameKey: 'rules_element_loup',       ruleIds: ['no_same_loup', 'forbid_loup_mouton'] },
  { id: 'ruche',      introLevel: 7,  nameKey: 'rules_element_ruche',      ruleIds: ['singleton_ruche', 'require_ours_ruche', 'all_ours_ruche'] },
  { id: 'cerf',       introLevel: 9,  nameKey: 'rules_element_cerf',       ruleIds: ['no_same_cerf', 'paired_cerf_biche', 'paired_exclusive_cerf'] },
  { id: 'biche',      introLevel: 9,  nameKey: 'rules_element_biche',      ruleIds: ['no_same_biche', 'paired_cerf_biche', 'paired_exclusive_biche'] },
  { id: 'tas_buches', introLevel: 11, nameKey: 'rules_element_tas_buches', ruleIds: ['chain_tas_buches'] },
  { id: 'chalet',     introLevel: 12, nameKey: 'rules_element_chalet',     ruleIds: ['no_same_chalet', 'require_chalet_bucheron', 'chain_tas_buches_chalet'] },
];

// Indexer toutes les RuleCards par ID (collectees depuis LEVEL_META)
const ALL_RULES_BY_ID = new Map<string, RuleCardData>();
for (let lvl = 1; lvl <= 15; lvl++) {
  const meta = LEVEL_META[lvl];
  if (!meta) continue;
  for (const rule of meta.allRules) {
    if (!ALL_RULES_BY_ID.has(rule.id)) ALL_RULES_BY_ID.set(rule.id, rule);
  }
}

export default function RulesScreen() {
  const t = useT();
  const player = usePlayerStore();
  const currentLevel = player.currentLevel;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { width } = useWindowDimensions();
  const frameBottom = height * FRAME_BOTTOM_FRACTION;
  const { innerTop, innerPadH } = useFrameLayout();
  // Largeur disponible = écran - 2×innerPadH (scroll) - 2×padding carte (16)
  const ruleCardWidth = width - innerPadH * 2 - 32;

  return (
    <View style={styles.root}>
      <BgImage />
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, innerTop + 8), paddingHorizontal: innerPadH + 4 }]}>
        <Text style={styles.title}>{t('rules_tab_title')}</Text>
        <Text style={styles.subtitle}>{t('rules_subtitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingHorizontal: innerPadH, paddingBottom: insets.bottom + frameBottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Slide intro : concept du jeu ── */}
        <View style={styles.introCard}>
          <IntroSlide />
        </View>

        {ELEMENT_ORDER.map((entry) => {
          const unlocked = currentLevel >= entry.introLevel;
          const def = ElementRegistry[entry.id];
          if (!def) return null;

          // Recuperer les RuleCards a afficher
          const ruleCards = entry.ruleIds
            .map(id => ALL_RULES_BY_ID.get(id))
            .filter((r): r is RuleCardData => !!r);

          return (
            <View
              key={entry.id}
              style={[
                styles.card,
                unlocked ? styles.cardUnlocked : styles.cardLocked,
              ]}
            >
              {/* ── Header : icone + nom ── */}
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: unlocked ? def.color + '20' : '#E0E0E0',
                      borderColor: unlocked ? def.color + '50' : '#BDBDBD',
                    },
                  ]}
                >
                  <Image
                    source={def.icon as any}
                    style={[
                      styles.iconImg,
                      !unlocked && styles.iconImgLocked,
                    ]}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.cardTitleArea}>
                  <Text
                    style={[
                      styles.elementName,
                      !unlocked && styles.elementNameLocked,
                    ]}
                  >
                    {t(entry.nameKey)}
                  </Text>
                  <Text
                    style={[
                      styles.levelTag,
                      !unlocked && styles.levelTagLocked,
                    ]}
                  >
                    {unlocked
                      ? t('rules_unlocked_at', { level: String(entry.introLevel) })
                      : t('rules_locked', { level: String(entry.introLevel) })}
                  </Text>
                </View>
              </View>

              {/* ── Animations des regles (memes que le briefing) ── */}
              {unlocked && ruleCards.length > 0 && (
                <View style={styles.rulesContainer}>
                  {ruleCards.map((rule) => (
                    <View key={rule.id} style={styles.ruleWrapper}>
                      <RuleCardComponent
                        rule={rule}
                        isNew={false}
                        width={ruleCardWidth}
                        animHeight={80}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* ── Verrouille ── */}
              {!unlocked && (
                <View style={styles.lockedHint}>
                  <Text style={styles.lockedHintText}>???</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // ── Header ──
  header: {
    paddingBottom: 12,
    gap: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Liste ──
  list: {
    paddingVertical: 16,
    gap: 12,
    paddingBottom: 32,
  },

  // ── Slide intro ──
  introCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 58, 26, 0.96)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },

  // ── Carte element ──
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
    overflow: 'hidden',
  },
  cardUnlocked: {
    backgroundColor: Colors.ui.card,
    borderColor: Colors.ui.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardLocked: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },

  // ── Header de carte ──
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconImg: {
    width: 38,
    height: 38,
  },
  iconImgLocked: {
    opacity: 0.25,
    tintColor: '#9E9E9E',
  },
  cardTitleArea: {
    flex: 1,
    gap: 3,
  },
  elementName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  elementNameLocked: {
    color: '#9E9E9E',
  },
  levelTag: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.forest.medium,
  },
  levelTagLocked: {
    color: '#BDBDBD',
  },

  // ── Zone regles animees ──
  rulesContainer: {
    gap: 8,
  },
  ruleWrapper: {
    backgroundColor: 'rgba(26, 58, 26, 0.92)',
    borderRadius: 14,
    overflow: 'hidden',
  },

  // ── Verrouille ──
  lockedHint: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  lockedHintText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#BDBDBD',
    letterSpacing: 4,
  },
});
