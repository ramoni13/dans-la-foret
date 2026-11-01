// ============================================================
// HINTOVERLAY — Barre de bonus avec compte à rebours pulsant
//
// Comportement au clic sur un bonus :
// - Affiche toujours la modale d'explication.
// - La modale a un bouton "Compris" qui ferme sans activer.
// - Si un élément est sélectionné (pour reveal_cell) ou si
//   la condition du bonus est remplie, un bouton "Activer !"
//   est affiché dans la modale.
//
// Recharge via pub (mode free uniquement) :
// - Quand TOUS les bonus sont épuisés ET que watchAdAvailable=true,
//   chaque bouton épuisé affiche une icône clap 🎬 (fond grisé mais cliquable).
// - Un clic ouvre WatchAdModal → visionnage simulé → recharge complète.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Platform,
} from 'react-native';

import { BonusId, BONUS_DEFINITIONS, BASE_BONUS_IDS } from '../../constants/bonus';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';
import { WatchAdModal } from './WatchAdModal';

const native = Platform.OS !== 'web';

interface HintOverlayProps {
  seeds: number;
  bonusUsed: BonusId[];
  selectedElement: string | null;
  isPremium: boolean;
  bonusDisabled: boolean;
  onActivateBonus: (bonusId: BonusId) => boolean;
  /** Utilisations journalières restantes par bonus */
  dailyBonusUses?: Record<BonusId, number>;
  /** Timestamp (Date.now() + durée) quand le bonus reveal expire */
  highlightDeadline?: number | null;
  /** Timestamp (Date.now() + durée) quand le bonus instinct expire */
  instinctDeadline?: number | null;
  /** Le bonus reveal est en mode actif (attente sélection case) */
  highlightActive?: boolean;
  /** Au moins un élément posé par le joueur (non fixe) sur le plateau */
  hasPlacedElements?: boolean;
  /** Slot optionnel affiché à droite de la barre (ex: bouton Valider) */
  rightSlot?: React.ReactNode;
  /** Le mode révélation est actif (en attente de sélection d'une case) */
  revealActive?: boolean;
  /**
   * Mode free : la recharge via pub est disponible (1 fois/jour).
   * true  = afficher l'icône clap sur les bonus épuisés.
   * false = déjà utilisé aujourd'hui, ne pas afficher.
   */
  watchAdAvailable?: boolean;
  /** Appelé après confirmation du visionnage de pub → déclenche le rechargement. */
  onWatchAd?: () => void;
}

// ── Composant countdown pulsant pour un seul bouton ──────────
const BonusCountdown: React.FC<{ deadline: number }> = ({ deadline }) => {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  );
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 500,
          useNativeDriver: native,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: native,
        }),
      ])
    );
    loopRef.current.start();
    return () => { loopRef.current?.stop(); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [deadline]);

  if (remaining <= 0) return null;

  return (
    <Animated.View
      style={[styles.countdownOverlay, { opacity: pulseAnim }]}
      pointerEvents="box-only"
    >
      <Text style={styles.countdownText}>{remaining}</Text>
    </Animated.View>
  );
};

// ── Modale d'explication bonus ────────────────────────────────
interface BonusExplainModalProps {
  visible: boolean;
  bonusId: BonusId;
  canActivate: boolean;
  onDismiss: () => void;
  onActivate: () => void;
}

const BonusExplainModal: React.FC<BonusExplainModalProps> = ({
  visible,
  bonusId,
  canActivate,
  onDismiss,
  onActivate,
}) => {
  const t = useT();
  const def = BONUS_DEFINITIONS[bonusId];

  const titleKey = bonusId === 'reveal_cell' ? 'bonus_reveal_title' : 'bonus_instinct_title';
  const descKey  = bonusId === 'reveal_cell' ? 'bonus_reveal_desc'  : 'bonus_instinct_desc';
  const step1Key = bonusId === 'reveal_cell' ? 'bonus_reveal_step1' : 'bonus_instinct_step1';
  const step2Key = bonusId === 'reveal_cell' ? 'bonus_reveal_step2' : 'bonus_instinct_step2';
  const step3Key = bonusId === 'reveal_cell' ? 'bonus_reveal_step3' : 'bonus_instinct_step3';

  const headerColor = bonusId === 'reveal_cell' ? '#F59E0B' : Colors.cell.wrong;

  const steps: { emoji: string; key: string }[] = [
    { emoji: bonusId === 'reveal_cell' ? '👆' : '🧩', key: step1Key },
    { emoji: bonusId === 'reveal_cell' ? '🔍' : '⚠️', key: step2Key },
    { emoji: bonusId === 'reveal_cell' ? '⏱️' : '🧠', key: step3Key },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          {/* En-tête */}
          <View style={[modalStyles.header, { backgroundColor: headerColor + '22' }]}>
            <Text style={modalStyles.headerEmoji}>{def.icon}</Text>
            <Text style={[modalStyles.title, { color: headerColor }]}>
              {t(titleKey)}
            </Text>
          </View>

          {/* Description */}
          <Text style={modalStyles.description}>{t(descKey)}</Text>

          {/* Étapes */}
          <View style={modalStyles.stepsContainer}>
            {steps.map((step, i) => (
              <View key={i} style={modalStyles.stepRow}>
                <View style={modalStyles.stepBadge}>
                  <Text style={modalStyles.stepEmoji}>{step.emoji}</Text>
                </View>
                <Text style={modalStyles.stepText}>{t(step.key)}</Text>
              </View>
            ))}
          </View>

          {/* Boutons */}
          <View style={modalStyles.buttonsRow}>
            <TouchableOpacity
              style={[modalStyles.btn, modalStyles.btnDismiss]}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <Text style={modalStyles.btnDismissText}>{t('bonus_tutorial_ok')}</Text>
            </TouchableOpacity>

            {canActivate && (
              <TouchableOpacity
                style={[modalStyles.btn, modalStyles.btnActivate, { backgroundColor: headerColor }]}
                onPress={onActivate}
                activeOpacity={0.8}
              >
                <Text style={modalStyles.btnActivateText}>{t('bonus_activate')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Composant principal ───────────────────────────────────────

export const HintOverlay: React.FC<HintOverlayProps> = ({
  seeds,
  bonusUsed,
  selectedElement,
  isPremium,
  bonusDisabled,
  onActivateBonus,
  dailyBonusUses,
  highlightDeadline = null,
  instinctDeadline = null,
  highlightActive = false,
  hasPlacedElements = false,
  rightSlot,
  revealActive = false,
  watchAdAvailable = false,
  onWatchAd,
}) => {
  const t = useT();

  // Modale d'explication ouverte
  const [explainBonusId, setExplainBonusId] = useState<BonusId | null>(null);

  // Modale pub
  const [watchAdVisible, setWatchAdVisible] = useState(false);

  const getDeadline = (bonusId: BonusId): number | null => {
    if (bonusId === 'reveal_cell') return highlightDeadline;
    if (bonusId === 'instinct')    return instinctDeadline;
    return null;
  };

  const isCooldown = (bonusId: BonusId): boolean => {
    const dl = getDeadline(bonusId);
    if (dl && dl > Date.now()) return true;
    // reveal_cell en attente de sélection → en cooldown visuel
    if (bonusId === 'reveal_cell' && (highlightActive || revealActive)) return true;
    return false;
  };

  /** Vérifie si le bonus peut être activé (conditions contextuelles) */
  const canActivateBonus = (bonusId: BonusId): boolean => {
    if (bonusId === 'reveal_cell') return true; // pas de prérequis pour révéler une case
    if (bonusId === 'instinct') return hasPlacedElements;
    return true;
  };

  /** true si TOUS les bonus du joueur (free) sont à 0 */
  const allBonusesExhausted = !isPremium && BASE_BONUS_IDS.every(
    id => (dailyBonusUses?.[id] ?? 0) <= 0
  );

  /** Clic sur l'icône clap d'un bonus épuisé → popup pub */
  const handleWatchAdPress = () => {
    setWatchAdVisible(true);
  };

  const handleWatchAdConfirm = () => {
    onWatchAd?.();
    setWatchAdVisible(false);
  };

  const handleBonus = (bonusId: BonusId) => {
    if (isCooldown(bonusId)) return;

    if (bonusDisabled) {
      setExplainBonusId(bonusId);
      return;
    }

    if (!isPremium && dailyBonusUses) {
      const remaining = dailyBonusUses[bonusId] ?? 0;
      if (remaining <= 0) {
        // Si la pub est disponible, on ouvre la popup pub au lieu de la modale bonus
        if (watchAdAvailable && allBonusesExhausted) {
          handleWatchAdPress();
          return;
        }
        setExplainBonusId(bonusId);
        return;
      }
    }

    // Toujours afficher la modale d'explication au clic
    setExplainBonusId(bonusId);
  };

  const handleModalDismiss = () => {
    setExplainBonusId(null);
  };

  const handleModalActivate = () => {
    const bonusId = explainBonusId;
    setExplainBonusId(null);
    if (!bonusId) return;

    if (bonusDisabled) return;

    if (!isPremium && dailyBonusUses) {
      const remaining = dailyBonusUses[bonusId] ?? 0;
      if (remaining <= 0) return;
    }

    onActivateBonus(bonusId);
  };

  const visibleBonusIds: BonusId[] = [...BASE_BONUS_IDS];

  const explainBonusCanActivate = explainBonusId
    ? !bonusDisabled &&
      (isPremium || (dailyBonusUses?.[explainBonusId] ?? 1) > 0) &&
      canActivateBonus(explainBonusId)
    : false;

  return (
    <View style={styles.container}>
      {/* Compteur de graines */}
      <View style={styles.seedsContainer}>
        <Text style={styles.seedsIcon}>🌱</Text>
        <Text style={styles.seedsCount}>{seeds}</Text>
      </View>

      {/* Indicateur mode révélation actif */}
      {revealActive && (
        <View style={styles.revealBanner}>
          <Text style={styles.revealBannerText}>{t('bonus_reveal_pick_cell')}</Text>
        </View>
      )}

      {/* Boutons bonus + slot droit */}
      <View style={styles.bonusRow}>
        {visibleBonusIds.map((bonusId) => {
          const def = BONUS_DEFINITIONS[bonusId];
          const alreadyUsed = bonusUsed.includes(def.id);
          const cooldown = isCooldown(bonusId);
          const remainingUses = isPremium ? Infinity : (dailyBonusUses?.[bonusId] ?? def.dailyLimit);
          const exhausted = !isPremium && remainingUses <= 0;
          const disabled = bonusDisabled || exhausted || cooldown;
          const dl = getDeadline(bonusId);

          const usesLabel = isPremium
            ? '\u221e'
            : `${remainingUses}/${def.dailyLimit}`;

          // Afficher l'icône clap si bonus épuisé + pub disponible + pas désactivé par bonusDisabled
          const showWatchAdClap =
            exhausted &&
            !bonusDisabled &&
            watchAdAvailable &&
            allBonusesExhausted;

          return (
            <View key={def.id} style={styles.bonusBtnWrapper}>
              <TouchableOpacity
                style={[
                  styles.bonusBtn,
                  disabled && !showWatchAdClap && styles.bonusBtnDisabled,
                  showWatchAdClap && styles.bonusBtnWatchAd,
                  alreadyUsed && !cooldown && !showWatchAdClap && styles.bonusBtnUsed,
                  cooldown && styles.bonusBtnCooldown,
                  revealActive && bonusId === 'reveal_cell' && styles.bonusBtnRevealActive,
                ]}
                onPress={() => handleBonus(def.id)}
                activeOpacity={cooldown ? 1 : 0.7}
                disabled={cooldown}
              >
                {showWatchAdClap ? (
                  <>
                    <Text style={styles.bonusIcon}>{def.icon}</Text>
                    <Text style={styles.bonusWatchAdClap}>🎬</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.bonusIcon}>{def.icon}</Text>
                    <Text style={[styles.bonusCost, exhausted && styles.bonusCostInsufficient]}>
                      {usesLabel}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Countdown pulsant superposé */}
              {cooldown && dl != null && dl > Date.now() && (
                <BonusCountdown deadline={dl} />
              )}
            </View>
          );
        })}
        {rightSlot != null && (
          <View style={styles.rightSlotWrapper}>{rightSlot}</View>
        )}
      </View>

      {/* Modale d'explication bonus */}
      {explainBonusId != null && (
        <BonusExplainModal
          visible
          bonusId={explainBonusId}
          canActivate={explainBonusCanActivate}
          onDismiss={handleModalDismiss}
          onActivate={handleModalActivate}
        />
      )}

      {/* Modale pub (recharge des bonus) */}
      <WatchAdModal
        visible={watchAdVisible}
        alreadyUsed={!watchAdAvailable}
        onConfirm={handleWatchAdConfirm}
        onDismiss={() => setWatchAdVisible(false)}
      />
    </View>
  );
};

// ── Styles HintOverlay ────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  seedsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.ui.seed + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.seed,
  },
  seedsIcon: {
    fontSize: 16,
  },
  seedsCount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ui.text,
  },
  revealBanner: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#F59E0B22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  revealBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
  bonusRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  rightSlotWrapper: {
    marginLeft: 4,
  },
  bonusBtnWrapper: {
    position: 'relative',
  },
  bonusBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.forest.light + '22',
    borderWidth: 1.5,
    borderColor: Colors.forest.light,
    gap: 2,
  },
  bonusBtnDisabled: {
    opacity: 0.4,
    backgroundColor: Colors.ui.border + '33',
    borderColor: Colors.ui.border,
  },
  bonusBtnUsed: {
    borderColor: Colors.forest.accent,
    backgroundColor: Colors.forest.accent + '22',
  },
  bonusBtnCooldown: {
    opacity: 1,
    borderColor: Colors.forest.accent,
    backgroundColor: Colors.forest.accent + '22',
  },
  bonusBtnRevealActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B22',
    borderWidth: 2,
  },
  bonusBtnWatchAd: {
    opacity: 0.85,
    backgroundColor: '#6366F111',
    borderColor: '#6366F1',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  bonusIcon: {
    fontSize: 20,
  },
  bonusWatchAdClap: {
    fontSize: 11,
    lineHeight: 13,
  },
  bonusCost: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  bonusCostInsufficient: {
    color: '#F44336',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: Colors.forest.medium + 'DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});

// ── Styles BonusExplainModal ──────────────────────────────────
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        }
      : {}),
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  headerEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    lineHeight: 20,
  },
  stepsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.ui.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  stepEmoji: {
    fontSize: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: Colors.ui.text,
    lineHeight: 18,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDismiss: {
    backgroundColor: Colors.ui.border + '55',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  btnDismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  btnActivate: {
    // backgroundColor défini dynamiquement (couleur du bonus)
  },
  btnActivateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
