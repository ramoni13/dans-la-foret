// ============================================================
// COOLDOWN SCREEN — Vue inline quand un défi est en cooldown
// Affiche un compte à rebours après un abandon
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../../constants/colors';

interface CooldownScreenProps {
  remainingMs: number;    // Temps restant initial (ms)
  onBack: () => void;     // Retour aux niveaux
}

/** Formate un nombre de millisecondes en "MMmin SSs" */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0min 0s';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}min ${sec}s`;
}

export const CooldownScreen: React.FC<CooldownScreenProps> = ({
  remainingMs,
  onBack,
}) => {
  const [remaining, setRemaining] = useState(remainingMs);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Calculer le timestamp de fin absolu pour éviter la dérive
    const endTime = Date.now() + remainingMs;

    const interval = setInterval(() => {
      const now = Date.now();
      const left = endTime - now;
      if (left <= 0) {
        setRemaining(0);
        setExpired(true);
        clearInterval(interval);
      } else {
        setRemaining(left);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingMs]);

  return (
    <View style={styles.container}>
      {/* Icone sablier */}
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>{'\u231B'}</Text>
      </View>

      <Text style={styles.title}>Defi en pause</Text>

      {expired ? (
        <>
          <Text style={styles.message}>
            Le cooldown est termine. Tu peux reprendre ce defi !
          </Text>
          <TouchableOpacity
            style={styles.btnResume}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Text style={styles.btnResumeText}>Reprendre</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.message}>
            Tu pourras retenter ce defi dans
          </Text>
          <Text style={styles.countdown}>{formatCountdown(remaining)}</Text>
          <TouchableOpacity
            style={styles.btnBack}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Text style={styles.btnBackText}>Retour aux niveaux</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    padding: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  countdown: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FF9800',
    marginBottom: 32,
  },
  btnBack: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  btnBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnResume: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 200,
    marginTop: 16,
  },
  btnResumeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
