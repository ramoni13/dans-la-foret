// ============================================================
// ForetCommuneWidget — Cagnotte collective "planter des arbres"
//
// Données temps réel depuis Firestore /foret_commune/global.
// Positionné en absolute-bottom par index.tsx — ne pas mettre
// position:absolute ici.
// TODO : brancher AdMob rewarded video sur le bouton "Pub".
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { usePlayerStore } from '../../store/playerStore';
import { subscribeForetCommune, addForetCommunePoints } from '../../services/foretCommuneService';
import { FORET_COMMUNE_POINTS_PER_VIDEO, FORET_COMMUNE_POINTS_PER_TREE } from '../../constants/foretCommune';
import { PremiumCard } from '../Premium/PremiumCard';

const LOGO_ONF = require('../../../assets/elements/design_app/logo-onf.png');

export function ForetCommuneWidget() {
  const isPremium     = usePlayerStore(s => s.isPremium);
  const unlockPremium = usePlayerStore(s => s.unlockPremium);

  const [cagnottePoints, setCagnottePoints] = useState(0);
  const [totalTrees,     setTotalTrees]     = useState(0);
  const [showPremium,    setShowPremium]     = useState(false);
  const [contributing,   setContributing]   = useState(false);

  useEffect(() => {
    const unsub = subscribeForetCommune(({ cagnottePoints: pts, totalTrees: trees }) => {
      setCagnottePoints(pts);
      setTotalTrees(trees);
    });
    return () => unsub();
  }, []);

  const handlePub = async () => {
    // TODO AdMob rewarded video — pour l'instant contribution directe en dev
    if (contributing) return;
    setContributing(true);
    try {
      await addForetCommunePoints(FORET_COMMUNE_POINTS_PER_VIDEO);
    } catch {
      // silencieux
    } finally {
      setContributing(false);
    }
  };

  const treesLabel = totalTrees === 0
    ? '0 arbre'
    : totalTrees === 1
      ? '1 arbre planté'
      : `${totalTrees} arbres plantés`;

  return (
    <View style={styles.wrapper}>
      {/* Logo ONF — à cheval sur le bord supérieur de la card */}
      <View style={styles.logoRow}>
        <Image source={LOGO_ONF} style={styles.onfLogo} resizeMode="contain" />
      </View>

      {/* Card semi-transparente */}
      <View style={styles.card}>
        {/* Compteur arbres — une seule ligne */}
        <Text style={styles.treesCount} numberOfLines={1}>
          🌳 {treesLabel} grâce à vous
        </Text>

        {/* Progression — une seule ligne */}
        <View style={styles.progressBox}>
          <Text style={styles.progressPts} numberOfLines={1}>
            {cagnottePoints.toLocaleString('fr-FR')} / {FORET_COMMUNE_POINTS_PER_TREE.toLocaleString('fr-FR')} pts = prochain arbre 🌱
          </Text>
        </View>

        {/* Deux boutons côte à côte */}
        <View style={styles.btnRow}>
          {/* Bouton 1 — Soutenir l'ONF (achat) — masqué si déjà premium */}
          {!isPremium && (
            <TouchableOpacity
              style={[styles.btn, styles.btnAcheter]}
              onPress={() => setShowPremium(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnAcheterText}>🌲 Soutenir l'ONF</Text>
              <Text style={styles.btnAcheterSub}>2,99 €</Text>
            </TouchableOpacity>
          )}

          {/* Bouton 2 — Regarder une pub */}
          <TouchableOpacity
            style={[styles.btn, styles.btnPub, contributing && styles.btnDisabled]}
            onPress={handlePub}
            activeOpacity={0.8}
            disabled={contributing}
          >
            <Text style={styles.btnPubText}>🎬 Contribuer</Text>
            <Text style={styles.btnPubSub}>{contributing ? '...' : '+100 pts · Regarder pub'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PremiumCard */}
      <PremiumCard
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onPurchase={() => {
          unlockPremium();
          setShowPremium(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Pas de position:absolute ici — géré par index.tsx
  },

  // Logo centré, chevauchant le bord supérieur de la card
  logoRow: {
    alignItems: 'center',
    marginBottom: -70,   // la moitié du logo dépasse dans la card
    zIndex: 2,
  },
  onfLogo: {
    width: 140,
    height: 140,
    borderRadius: 20,
  },

  // Card principale semi-transparente
  card: {
    backgroundColor: 'rgba(10, 28, 10, 0.72)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,195,74,0.20)',
    paddingTop: 30,      // moitié du logo (70) + marge réduite
    paddingBottom: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 3,
  },

  treesCount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  progressBox: {
    backgroundColor: 'rgba(139,195,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,195,74,0.30)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 2,
    gap: 1,
  },
  progressPts: {
    color: '#8BC34A',
    fontSize: 12,
    fontWeight: '700',
  },

  // Ligne des boutons
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 1,
  },

  // Bouton Soutenir (achat)
  btnAcheter: {
    backgroundColor: 'rgba(139,195,74,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(139,195,74,0.50)',
  },
  btnAcheterText: {
    color: '#8BC34A',
    fontSize: 13,
    fontWeight: '700',
  },
  btnAcheterSub: {
    color: 'rgba(139,195,74,0.75)',
    fontSize: 11,
    fontWeight: '500',
  },

  // Bouton Pub
  btnPub: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  btnPubText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  btnPubSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },

  btnDisabled: {
    opacity: 0.45,
  },
});
