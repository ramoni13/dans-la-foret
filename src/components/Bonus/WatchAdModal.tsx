// ============================================================
// WATCHADMODAL — Popup de visionnage d'une pub pour recharger
// tous les bonus (1 fois par jour, mode free uniquement).
//
// États :
//  'idle'     → description + bouton "Regarder"
//  'watching' → compte à rebours simulé (5 s)
//  'done'     → confirmation + bouton "Récupérer"
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';

const AD_DURATION_MS = 5_000; // durée simulée de la pub (ms)
const TICK_MS        = 200;

type WatchAdState = 'idle' | 'watching' | 'done';

interface WatchAdModalProps {
  visible: boolean;
  alreadyUsed: boolean;   // true = joueur a déjà regardé la pub aujourd'hui
  onConfirm: () => void;  // appelé après la pub → déclenche le rechargement
  onDismiss: () => void;
}

export const WatchAdModal: React.FC<WatchAdModalProps> = ({
  visible,
  alreadyUsed,
  onConfirm,
  onDismiss,
}) => {
  const t = useT();
  const [phase, setPhase] = useState<WatchAdState>('idle');
  const [remaining, setRemaining] = useState(Math.ceil(AD_DURATION_MS / 1000));

  // Animation de progression circulaire (pulse)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopRef      = useRef<Animated.CompositeAnimation | null>(null);

  // Reset l'état interne à chaque ouverture
  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setRemaining(Math.ceil(AD_DURATION_MS / 1000));
      progressAnim.setValue(0);
    } else {
      // Nettoyer si on ferme pendant le visionnage
      timerRef.current && clearInterval(timerRef.current);
      loopRef.current?.stop();
    }
  }, [visible]);

  const startWatching = () => {
    setPhase('watching');
    const deadline = Date.now() + AD_DURATION_MS;

    // Compte à rebours
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        timerRef.current && clearInterval(timerRef.current);
        loopRef.current?.stop();
        setPhase('done');
      }
    }, TICK_MS);

    // Animation pulsante sur l'icône vidéo
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(progressAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loopRef.current.start();
  };

  const handleConfirm = () => {
    onConfirm();
    onDismiss();
  };

  const handleDismiss = () => {
    // Ne pas laisser fermer pendant le visionnage
    if (phase === 'watching') return;
    timerRef.current && clearInterval(timerRef.current);
    loopRef.current?.stop();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>

          {/* En-tête */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>
              {phase === 'done' ? '🎉' : '🎬'}
            </Text>
            <Text style={styles.title}>
              {phase === 'done'
                ? t('watch_ad_modal_done')
                : t('watch_ad_modal_title')}
            </Text>
          </View>

          {/* Corps */}
          {alreadyUsed ? (
            <Text style={styles.desc}>{t('watch_ad_already_used')}</Text>
          ) : phase === 'idle' ? (
            <Text style={styles.desc}>{t('watch_ad_modal_desc')}</Text>
          ) : phase === 'watching' ? (
            <View style={styles.watchingContainer}>
              <Animated.Text style={[styles.watchingIcon, { opacity: progressAnim }]}>
                🎬
              </Animated.Text>
              <Text style={styles.watchingLabel}>{t('watch_ad_modal_watching')}</Text>
              <Text style={styles.countdown}>{remaining}</Text>
            </View>
          ) : (
            /* done */
            <Text style={styles.desc}>{t('watch_ad_modal_refilled')}</Text>
          )}

          {/* Boutons */}
          <View style={styles.buttonsRow}>
            {/* Bouton Annuler / Fermer — masqué pendant le visionnage */}
            {phase !== 'watching' && (
              <TouchableOpacity
                style={[styles.btn, styles.btnDismiss]}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.btnDismissText}>
                  {t('watch_ad_modal_cancel')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Bouton principal */}
            {!alreadyUsed && phase === 'idle' && (
              <TouchableOpacity
                style={[styles.btn, styles.btnWatch]}
                onPress={startWatching}
                activeOpacity={0.8}
              >
                <Text style={styles.btnWatchText}>{t('watch_ad_cta')}</Text>
              </TouchableOpacity>
            )}

            {phase === 'done' && (
              <TouchableOpacity
                style={[styles.btn, styles.btnWatch]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.btnWatchText}>{t('watch_ad_modal_done')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    backgroundColor: '#6366F122',
    gap: 8,
  },
  headerEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6366F1',
  },
  desc: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    lineHeight: 20,
  },
  watchingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  watchingIcon: {
    fontSize: 48,
  },
  watchingLabel: {
    fontSize: 14,
    color: Colors.ui.textLight,
  },
  countdown: {
    fontSize: 36,
    fontWeight: '900',
    color: '#6366F1',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
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
  btnWatch: {
    backgroundColor: '#6366F1',
  },
  btnWatchText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
