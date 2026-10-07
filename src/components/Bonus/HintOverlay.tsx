// ============================================================
// HINTOVERLAY — Barre de bonus avec compte à rebours pulsant
//
// Chaque bonus a un countdown indépendant superposé au bouton.
// Le bouton est bloqué tant que le countdown est actif.
// Les deux countdowns peuvent coexister.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Platform,
} from 'react-native';

import { BonusId, BONUS_DEFINITIONS, BASE_BONUS_IDS, ADVANCED_BONUS_IDS } from '../../constants/bonus';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';
import { BonusTutorialModal } from './BonusTutorialModal';

const native = Platform.OS !== 'web';

interface HintOverlayProps {
  seeds: number;
  bonusUsed: BonusId[];
  selectedElement: string | null;
  isPremium: boolean;
  bonusDisabled: boolean;
  onActivateBonus: (bonusId: BonusId) => boolean;
  /** Bonus avancés débloqués via badges (instinct) */
  unlockedBonuses?: BonusId[];
  /** Timestamp (Date.now() + durée) quand le bonus highlight expire */
  highlightDeadline?: number | null;
  /** Timestamp (Date.now() + durée) quand le bonus instinct expire */
  instinctDeadline?: number | null;
  /** Le bonus highlight est en mode actif (10s) */
  highlightActive?: boolean;
  /** Au moins un élément posé par le joueur (non fixe) sur le plateau */
  hasPlacedElements?: boolean;
}

// ── Composant countdown pulsant pour un seul bouton ──────────
const BonusCountdown: React.FC<{ deadline: number }> = ({ deadline }) => {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  );
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  // Pulsation
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

  // Décompte chaque seconde
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

export const HintOverlay: React.FC<HintOverlayProps> = ({
  seeds,
  bonusUsed,
  selectedElement,
  isPremium,
  bonusDisabled,
  onActivateBonus,
  unlockedBonuses = [],
  highlightDeadline = null,
  instinctDeadline = null,
  highlightActive = false,
  hasPlacedElements = false,
}) => {
  const t = useT();
  const dismissed = usePlayerStore(s => s.bonusTutorialDismissed);
  const dismissTutorial = usePlayerStore(s => s.dismissBonusTutorial);

  // Tutoriel modal state
  const [tutorialBonusId, setTutorialBonusId] = useState<BonusId | null>(null);

  const getDeadline = (bonusId: BonusId): number | null => {
    if (bonusId === 'highlight_valid_cells') return highlightDeadline;
    if (bonusId === 'instinct') return instinctDeadline;
    return null;
  };

  const isCooldown = (bonusId: BonusId): boolean => {
    const dl = getDeadline(bonusId);
    if (dl && dl > Date.now()) return true;
    // Le bonus highlight en mode actif est en cooldown
    if (bonusId === 'highlight_valid_cells' && highlightActive) return true;
    return false;
  };

  /** Appelé quand le joueur ferme le tuto modal → active le bonus */
  const handleTutorialConfirm = (dontShowAgain: boolean) => {
    const bonusId = tutorialBonusId;
    setTutorialBonusId(null);
    if (!bonusId) return;
    if (dontShowAgain) dismissTutorial(bonusId);
    onActivateBonus(bonusId);
  };

  const handleBonus = (bonusId: BonusId) => {
    const def = BONUS_DEFINITIONS[bonusId];

    // Bonus en cours → bloqué
    if (isCooldown(bonusId)) return;

    // Bonus verrouillé
    if (def.requiresUnlock && !unlockedBonuses.includes(bonusId)) {
      Alert.alert('Bonus verrouillé 🔒', 'Débloque 3 badges Or pour accéder au bonus Instinct.');
      return;
    }

    if (bonusDisabled) {
      Alert.alert('Mode Maître', 'Les bonus sont désactivés en mode Maître !');
      return;
    }

    if (seeds < def.cost) {
      Alert.alert(
        'Pas assez de graines 🌱',
        `Ce bonus coûte ${def.cost} graines. Tu en as ${seeds}.`
      );
      return;
    }

    // ── Gardes de contexte ──────────────────────────────────
    // Cases valides : nécessite un élément sélectionné
    if (bonusId === 'highlight_valid_cells' && !selectedElement) {
      Alert.alert('💡', t('bonus_need_selection'));
      return;
    }

    // Instinct : nécessite au moins un élément posé (non fixe)
    if (bonusId === 'instinct' && !hasPlacedElements) {
      Alert.alert('🔴', t('bonus_need_placement'));
      return;
    }

    // ── Tutoriel modal ──────────────────────────────────────
    if (!dismissed.includes(bonusId)) {
      setTutorialBonusId(bonusId);
      return; // Le bonus sera activé après fermeture du tuto
    }

    onActivateBonus(bonusId);
  };

  const visibleBonusIds: BonusId[] = [
    ...BASE_BONUS_IDS,
    ...ADVANCED_BONUS_IDS,
  ];

  return (
    <View style={styles.container}>
      {/* Compteur de graines */}
      <View style={styles.seedsContainer}>
        <Text style={styles.seedsIcon}>🌱</Text>
        <Text style={styles.seedsCount}>{seeds}</Text>
      </View>

      {/* Boutons bonus */}
      <View style={styles.bonusRow}>
        {visibleBonusIds.map((bonusId) => {
          const def = BONUS_DEFINITIONS[bonusId];
          const alreadyUsed = bonusUsed.includes(def.id);
          const canAfford = seeds >= def.cost;
          const locked = def.requiresUnlock && !unlockedBonuses.includes(bonusId);
          const cooldown = isCooldown(bonusId);
          const disabled = bonusDisabled || !canAfford || locked || cooldown;
          const dl = getDeadline(bonusId);

          return (
            <View key={def.id} style={styles.bonusBtnWrapper}>
              <TouchableOpacity
                style={[
                  styles.bonusBtn,
                  disabled && styles.bonusBtnDisabled,
                  alreadyUsed && !cooldown && styles.bonusBtnUsed,
                  locked && styles.bonusBtnLocked,
                  cooldown && styles.bonusBtnCooldown,
                ]}
                onPress={() => handleBonus(def.id)}
                activeOpacity={cooldown ? 1 : 0.7}
                disabled={cooldown}
              >
                <Text style={styles.bonusIcon}>{locked ? '🔒' : def.icon}</Text>
                <Text style={[styles.bonusCost, !canAfford && !locked && styles.bonusCostInsufficient]}>
                  {locked ? '' : `${def.cost}🌱`}
                </Text>
              </TouchableOpacity>

              {/* Countdown pulsant superposé */}
              {cooldown && dl != null && dl > Date.now() && (
                <BonusCountdown deadline={dl} />
              )}
            </View>
          );
        })}
      </View>

      {/* Modal tutoriel bonus */}
      {tutorialBonusId != null && (
        <BonusTutorialModal
          visible
          bonusId={tutorialBonusId}
          onConfirm={handleTutorialConfirm}
        />
      )}
    </View>
  );
};

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
  bonusRow: {
    flexDirection: 'row',
    gap: 8,
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
  bonusBtnLocked: {
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.border + '44',
    opacity: 0.6,
  },
  bonusBtnCooldown: {
    opacity: 1,
    borderColor: Colors.forest.accent,
    backgroundColor: Colors.forest.accent + '22',
  },
  bonusIcon: {
    fontSize: 20,
  },
  bonusCost: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  bonusCostInsufficient: {
    color: '#F44336',
  },
  // ── Countdown pulsant superposé au bouton ──────────────────
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
