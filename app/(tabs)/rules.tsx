// ============================================================
// ECRAN REGLES
// Deux onglets :
//   1) Les habitants — règles de chaque élément (comportement actuel)
//   2) Les défis     — description des 4 types de défis
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../src/constants/colors';
import { useFrameLayout } from '../../src/constants/frameLayout';
import { BgImage } from '../../src/components/UI/BgImage';
import { usePlayerStore } from '../../src/store/playerStore';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import { useT } from '../../src/i18n';
import { LEVEL_META, RuleCard as RuleCardData } from '../../src/data/levelMeta';
import { RuleCard as RuleCardComponent } from '../../src/components/LevelBriefing/RuleCard';
import { IntroSlide } from '../../src/components/LevelBriefing/IntroSlide';

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
  { id: 'champignon', introLevel: 17, nameKey: 'rules_element_champignon', ruleIds: ['center_only_champignon', 'no_same_champignon'] },
  { id: 'arbre',      introLevel: 19, nameKey: 'rules_element_arbre',      ruleIds: ['connected_arbre', 'connected_arbre_buches'] },
];

// Indexer toutes les RuleCards par ID (collectees depuis LEVEL_META)
const ALL_RULES_BY_ID = new Map<string, RuleCardData>();
for (let lvl = 1; lvl <= 21; lvl++) {
  const meta = LEVEL_META[lvl];
  if (!meta) continue;
  for (const rule of meta.allRules) {
    if (!ALL_RULES_BY_ID.has(rule.id)) ALL_RULES_BY_ID.set(rule.id, rule);
  }
}

// ── Types de défis ─────────────────────────────────────────────────────────
interface ChallengeTypeEntry {
  icon: string;
  titleKey: string;
  color: string;
  content: React.ReactNode;
}

// ── Sous-composant : carte d'un type de défi ───────────────────────────────
function ChallengeCard({ icon, titleKey, color, children }: {
  icon: string;
  titleKey: string;
  color: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <View style={[challengeStyles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={challengeStyles.cardHeader}>
        <View style={[challengeStyles.iconBadge, { backgroundColor: color + '22' }]}>
          <Text style={challengeStyles.iconText}>{icon}</Text>
        </View>
        <Text style={[challengeStyles.cardTitle, { color }]}>{t(titleKey)}</Text>
      </View>
      <View style={challengeStyles.cardBody}>
        {children}
      </View>
    </View>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View style={challengeStyles.bullet}>
      <Text style={challengeStyles.bulletDot}>·</Text>
      <Text style={challengeStyles.bulletText}>{text}</Text>
    </View>
  );
}

// ── Onglet 2 : Les défis ───────────────────────────────────────────────────
function ChallengesTab({ frameBottom, innerPadH }: { frameBottom: number; innerPadH: number }) {
  const t = useT();
  return (
    <ScrollView
      contentContainerStyle={[styles.list, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Défis solos ── */}
      <ChallengeCard icon="🏆" titleKey="challenges_solo_title" color="#2E7D32">
        <BulletItem text={t('challenges_solo_desc1')} />
        <BulletItem text={t('challenges_solo_desc2')} />
        <BulletItem text={t('challenges_solo_desc3')} />
        <BulletItem text={t('challenges_solo_desc4')} />
        <BulletItem text={t('challenges_solo_desc5')} />
        <BulletItem text={t('challenges_solo_desc6')} />
      </ChallengeCard>

      {/* ── Défi du jour ── */}
      <ChallengeCard icon="📅" titleKey="challenges_daily_title" color="#E65100">
        <Text style={challengeStyles.paraText}>{t('challenges_daily_desc')}</Text>
      </ChallengeCard>

      {/* ── Défis entre amis ── */}
      <ChallengeCard icon="🤝" titleKey="challenges_friends_title" color="#1565C0">
        <Text style={challengeStyles.paraText}>{t('challenges_friends_desc')}</Text>
      </ChallengeCard>

      {/* ── Mode ONF ── */}
      <ChallengeCard icon="🌲" titleKey="challenges_onf_title" color="#6A1B9A">
        <Text style={challengeStyles.paraText}>{t('challenges_onf_desc')}</Text>
      </ChallengeCard>
    </ScrollView>
  );
}

// ── Ecran principal ────────────────────────────────────────────────────────
export default function RulesScreen() {
  const t = useT();
  const player = usePlayerStore();
  const currentLevel = player.currentLevel;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { frameBottom, innerTop, innerPadH } = useFrameLayout();
  const ruleCardWidth = width - innerPadH * 2 - 32;

  const [activeTab, setActiveTab] = useState<'inhabitants' | 'challenges'>('inhabitants');

  return (
    <View style={styles.root}>
      <BgImage overlay={0.52} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, innerTop + 20), paddingHorizontal: innerPadH + 4 }]}>
        <Text style={styles.title}>{t('rules_tab_title')}</Text>

        {/* ── Tab switcher ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'inhabitants' && styles.tabBtnActive]}
            onPress={() => setActiveTab('inhabitants')}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabLabel, activeTab === 'inhabitants' && styles.tabLabelActive]}>
              {t('rules_tab_inhabitants')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'challenges' && styles.tabBtnActive]}
            onPress={() => setActiveTab('challenges')}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabLabel, activeTab === 'challenges' && styles.tabLabelActive]}>
              {t('rules_tab_challenges')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Contenu ── */}
      {activeTab === 'inhabitants' ? (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Slide intro */}
          <View style={styles.introCard}>
            <IntroSlide />
          </View>

          {ELEMENT_ORDER.map((entry) => {
            const unlocked = currentLevel >= entry.introLevel;
            const def = ElementRegistry[entry.id];
            if (!def) return null;

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
                {/* Header : icone + nom */}
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

                {/* Animations des regles */}
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

                {/* Verrouille */}
                {!unlocked && (
                  <View style={styles.lockedHint}>
                    <Text style={styles.lockedHintText}>???</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ChallengesTab frameBottom={frameBottom} innerPadH={innerPadH} />
      )}
    </View>
  );
}

// ── Styles partagés ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // ── Header ──
  header: {
    paddingBottom: 4,
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // ── Tab switcher ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  tabLabelActive: {
    color: Colors.forest.dark,
  },

  // ── Liste ──
  list: {
    paddingTop: 12,
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
    opacity: 0.35,
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

// ── Styles onglet Défis ────────────────────────────────────────────────────
const challengeStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  cardBody: {
    gap: 6,
    paddingLeft: 4,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 16,
    color: '#555',
    lineHeight: 22,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    flex: 1,
  },
  paraText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
});
