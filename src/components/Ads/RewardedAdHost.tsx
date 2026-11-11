// ============================================================
// REWARDEDADHOST — affiche la pub volontaire (SIMULÉE) : recharge d'un bonus ou Forêt commune
//
// Monté UNE FOIS dans le layout racine. Il s'enregistre auprès de `rewardedAdService` ; les écrans appellent
// `showRewardedAd(placement)` sans rien savoir de la modale. Au Lot E, le SDK publicitaire réel remplace ce
// composant (il n'aura plus qu'à se désenregistrer).
//
// États : 'intro' (ce que le joueur gagne + « Regarder ») → 'watching' (compte à rebours simulé) → 'done'
// (« Récupérer »). Fermer pendant le visionnage est impossible ; fermer avant (« Annuler ») → 'dismissed'.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ONF_AD_RECHARGE_GRIDS, type AdPlacement } from '../../constants/adRewards';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import {
  RewardedAdResult,
  SIMULATED_AD_DURATION_MS,
  makeResult,
  registerRewardedAdPresenter,
} from '../../services/rewardedAdService';

const TICK_MS = 200;

type Phase = 'intro' | 'watching' | 'done';

interface Pending {
  placement: AdPlacement;
  resolve: (r: RewardedAdResult) => void;
}

/** Clés i18n du titre et de la description par emplacement. */
export function adTextKeys(placement: AdPlacement): { title: string; desc: string; done: string } {
  switch (placement) {
    case 'bonus_reveal_cell':
    case 'bonus_instinct':
      return { title: 'ad_bonus_title', desc: placement === 'bonus_reveal_cell' ? 'ad_bonus_reveal_desc' : 'ad_bonus_instinct_desc', done: 'ad_bonus_done' };
    case 'foret_commune':
      return { title: 'ad_foret_title', desc: 'ad_foret_desc', done: 'ad_foret_done' };
    case 'onf_recharge':
      return { title: 'ad_onf_title', desc: 'ad_onf_desc', done: 'ad_onf_done' };
  }
}

export const RewardedAdHost: React.FC = () => {
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [remaining, setRemaining] = useState(Math.ceil(SIMULATED_AD_DURATION_MS / 1000));

  const pendingRef = useRef<Pending | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    loopRef.current?.stop();
    loopRef.current = null;
  }, []);

  /** Termine la pub en cours avec une issue ; ferme la modale. */
  const finish = useCallback((outcome: Parameters<typeof makeResult>[0]) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    stopTimers();
    setPending(null);
    p?.resolve(makeResult(outcome));
  }, [stopTimers]);

  // Enregistrement auprès du service. Une pub à la fois : une 2e demande pendant qu'une pub est affichée
  // est refusée (« unavailable »), jamais empilée.
  useEffect(() => {
    registerRewardedAdPresenter(placement => new Promise<RewardedAdResult>(resolve => {
      if (pendingRef.current) { resolve(makeResult('unavailable')); return; }
      const p: Pending = { placement, resolve };
      pendingRef.current = p;
      setPhase('intro');
      setRemaining(Math.ceil(SIMULATED_AD_DURATION_MS / 1000));
      setPending(p);
    }));
    return () => {
      registerRewardedAdPresenter(null);
      stopTimers();
      // Hôte démonté pendant une pub : jamais de récompense
      pendingRef.current?.resolve(makeResult('dismissed'));
      pendingRef.current = null;
    };
  }, [stopTimers]);

  const startWatching = () => {
    setPhase('watching');
    const deadline = Date.now() + SIMULATED_AD_DURATION_MS;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        stopTimers();
        setPhase('done');
      }
    }, TICK_MS);
    pulse.setValue(1);
    loopRef.current = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loopRef.current.start();
  };

  const handleCancel = () => {
    if (phase === 'watching') return; // impossible de quitter pendant la pub
    finish('dismissed');
  };

  const keys = pending ? adTextKeys(pending.placement) : null;

  return (
    <Modal visible={!!pending} transparent animationType="fade" statusBarTranslucent onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>{phase === 'done' ? '🎉' : '🎬'}</Text>
            <Text style={styles.title}>{keys ? t(phase === 'done' ? 'ad_done_title' : keys.title) : ''}</Text>
          </View>

          {phase === 'intro' && keys && <Text style={styles.desc}>{t(keys.desc, { count: String(ONF_AD_RECHARGE_GRIDS) })}</Text>}
          {phase === 'watching' && (
            <View style={styles.watching}>
              <Animated.Text style={[styles.watchingIcon, { opacity: pulse }]}>🎬</Animated.Text>
              <Text style={styles.watchingLabel}>{t('ad_watching')}</Text>
              <Text style={styles.countdown}>{remaining}</Text>
            </View>
          )}
          {phase === 'done' && keys && <Text style={styles.desc}>{t(keys.done, { count: String(ONF_AD_RECHARGE_GRIDS) })}</Text>}

          <View style={styles.buttons}>
            {phase !== 'watching' && (
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancel} activeOpacity={0.8}>
                <Text style={styles.btnCancelText}>{t('ad_cancel')}</Text>
              </TouchableOpacity>
            )}
            {phase === 'intro' && (
              <TouchableOpacity style={[styles.btn, styles.btnMain]} onPress={startWatching} activeOpacity={0.8}>
                <Text style={styles.btnMainText}>{t('ad_watch_cta')}</Text>
              </TouchableOpacity>
            )}
            {phase === 'done' && (
              <TouchableOpacity style={[styles.btn, styles.btnMain]} onPress={() => finish('earned')} activeOpacity={0.8}>
                <Text style={styles.btnMainText}>{t('ad_claim')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    ...(Platform.OS !== 'web'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }
      : {}),
  },
  header: { alignItems: 'center', paddingVertical: 20, backgroundColor: '#6366F122', gap: 8 },
  headerEmoji: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: '800', color: '#6366F1', textAlign: 'center', paddingHorizontal: 12 },
  desc: { fontSize: 14, color: Colors.ui.textLight, textAlign: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, lineHeight: 20 },
  watching: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  watchingIcon: { fontSize: 48 },
  watchingLabel: { fontSize: 14, color: Colors.ui.textLight },
  countdown: { fontSize: 36, fontWeight: '900', color: '#6366F1' },
  buttons: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: Colors.ui.border + '55', borderWidth: 1, borderColor: Colors.ui.border },
  btnCancelText: { fontSize: 15, fontWeight: '600', color: Colors.ui.textLight },
  btnMain: { backgroundColor: '#6366F1' },
  btnMainText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
