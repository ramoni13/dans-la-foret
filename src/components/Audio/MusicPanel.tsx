// ============================================================
// MUSICPANEL — Pavé de gestion de la musique dans le Profil
//
// Structure :
//   - Ligne "Ambiance Forêt"  (menu)  : toggle + listbox + play
//   - Ligne "Ambiance Défi"   (ingame): toggle + listbox + play
//   - Barre de volume
//   - Section "Acheter" pour les titres verrouillés
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { AudioPlayer } from 'expo-audio';

import { Colors } from '../../constants/colors';
import { useAudioStore } from '../../store/audioStore';
import { usePlayerStore } from '../../store/playerStore';
import { MUSIC_CATALOG, MusicTrack, MUSIC_UNLOCK_COST } from '../../constants/music';
import { audioService } from '../../services/audioService';
import { MusicUnlockModal } from './MusicUnlockModal';

// Slider natif ou fallback web
let Slider: any = null;
try {
  // expo-av n'inclut pas de slider — on utilise une implémentation simple
  Slider = null;
} catch (_) {}

// ── Composant RowPicker ────────────────────────────────────────
// Une ligne : toggle + libellé type + listbox (si > 1 titre) + bouton play

interface RowPickerProps {
  typeLabel: string;
  typeEmoji: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  tracks: MusicTrack[];
  selectedId: string;
  onSelect: (id: string) => void;
  previewTrackId: string | null;
  onTogglePreview: (track: MusicTrack) => void;
}

function RowPicker({
  typeLabel, typeEmoji,
  enabled, onToggle,
  tracks, selectedId, onSelect,
  previewTrackId, onTogglePreview,
}: RowPickerProps) {
  const isPlaying = !!previewTrackId && tracks.some(t => t.id === previewTrackId);
  const selectedTrack = tracks.find(t => t.id === selectedId) ?? tracks[0];

  return (
    <View style={rowStyles.container}>
      {/* Toggle + libellé */}
      <View style={rowStyles.header}>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          thumbColor={enabled ? Colors.forest.accent : Colors.ui.border}
          trackColor={{ false: Colors.ui.border, true: Colors.forest.light + '80' }}
        />
        <Text style={rowStyles.typeLabel}>{typeEmoji} {typeLabel}</Text>
      </View>

      {/* Listbox (si > 1 titre disponible) */}
      <View style={rowStyles.pickRow}>
        {tracks.length > 1 ? (
          <View style={rowStyles.listBox}>
            {tracks.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[rowStyles.listItem, selectedId === t.id && rowStyles.listItemSelected]}
                onPress={() => onSelect(t.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    rowStyles.listItemText,
                    selectedId === t.id && rowStyles.listItemTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {t.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={rowStyles.singleTrack}>
            <Text style={rowStyles.singleTrackText}>{selectedTrack?.title ?? '—'}</Text>
          </View>
        )}

        {/* Bouton play/stop preview */}
        {selectedTrack && (
          <TouchableOpacity
            style={[rowStyles.playBtn, isPlaying && rowStyles.playBtnActive]}
            onPress={() => onTogglePreview(
              tracks.find(t => t.id === (previewTrackId && isPlaying ? previewTrackId : selectedId)) ?? selectedTrack
            )}
            activeOpacity={0.7}
          >
            <Text style={rowStyles.playBtnIcon}>{isPlaying ? '⏹' : '▶'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.background,
    overflow: 'hidden',
  },
  listItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  listItemSelected: {
    backgroundColor: Colors.forest.light + '20',
    borderLeftWidth: 3,
    borderLeftColor: Colors.forest.medium,
  },
  listItemText: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  listItemTextSelected: {
    color: Colors.forest.dark,
    fontWeight: '700',
  },
  singleTrack: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.background,
  },
  singleTrackText: {
    fontSize: 13,
    color: Colors.forest.dark,
    fontWeight: '600',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.forest.light + '20',
    borderWidth: 1.5,
    borderColor: Colors.forest.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: Colors.forest.accent + '30',
    borderColor: Colors.forest.accent,
  },
  playBtnIcon: {
    fontSize: 16,
  },
});

// ── Composant principal MusicPanel ────────────────────────────

export function MusicPanel() {
  const audioStore  = useAudioStore();
  const player      = usePlayerStore();

    // Preview en cours (expo-audio AudioPlayer instance)
  const previewSoundRef    = useRef<AudioPlayer | null>(null);
  const previewTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  // Modal déblocage
  const [unlockModalTrackId, setUnlockModalTrackId] = useState<string | null>(null);

  // Séparer les morceaux par type, uniquement les possédés
  const ownedIngame = MUSIC_CATALOG.filter(
    t => t.type === 'ingame' && audioStore.ownedTrackIds.includes(t.id)
  );
  const ownedMenu = MUSIC_CATALOG.filter(
    t => t.type === 'menu' && audioStore.ownedTrackIds.includes(t.id)
  );

  // Morceaux verrouillés
  const lockedTracks = MUSIC_CATALOG.filter(
    t => !audioStore.ownedTrackIds.includes(t.id)
  );

  // ── Gestion du preview ────────────────────────────────────
  const stopPreview = async () => {
    // Annuler le timer auto-stop
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewSoundRef.current) {
      const s = previewSoundRef.current;
      previewSoundRef.current = null;
      // Déléguer l'arrêt propre au service (gère le bug web ontimeupdate)
      await audioService.stopPreviewSound(s);
    }
    setPreviewTrackId(null);
    // Signaler au store que le preview est terminé (reprend la musique principale)
    audioStore.setPreviewTrack(null);
  };

  const togglePreview = async (track: MusicTrack) => {
    if (previewTrackId === track.id) {
      await stopPreview();
      return;
    }

    // Arrêter l'éventuel preview précédent
    await stopPreview();

    // Signaler au AudioController qu'un preview démarre (pause la musique principale)
    audioStore.setPreviewTrack(track.id);
    setPreviewTrackId(track.id);

    const sound = await audioService.playPreview(track.file, audioStore.volume);
    if (sound) {
      previewSoundRef.current = sound;

            // expo-audio : écouter la fin de lecture via addListener
      if (Platform.OS !== 'web') {
        sound.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) stopPreview();
        });
      }

      // Timer de sécurité : arrêt auto après 30 secondes de preview max
      previewTimerRef.current = setTimeout(() => {
        stopPreview();
      }, 30_000);
    } else {
      setPreviewTrackId(null);
      audioStore.setPreviewTrack(null);
    }
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      // stopPreview est async mais on ne peut pas await dans cleanup —
      // on appelle stopPreviewSound directement si un son est en cours
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (previewSoundRef.current) {
        const s = previewSoundRef.current;
        previewSoundRef.current = null;
        audioService.stopPreviewSound(s).catch(() => {});
      }
      audioStore.setPreviewTrack(null);
    };
  }, []);

  // ── Achat d'un titre avec des graines ────────────────────
  const handleBuyTrack = (track: MusicTrack) => {
    if (player.seeds < track.cost) return;
    const success = player.spendSeeds(track.cost);
    if (!success) return;
    audioStore.unlockTrack(track.id);
    setUnlockModalTrackId(track.id);
  };

  // ── Volume — slider simplifié via 5 boutons ───────────────
  const VOLUMES = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>🎵 Musique</Text>

      {/* Ligne Ambiance Forêt (menu) */}
      <RowPicker
        typeLabel="Ambiance Forêt"
        typeEmoji="🌲"
        enabled={audioStore.menuEnabled}
        onToggle={audioStore.setMenuEnabled}
        tracks={ownedMenu}
        selectedId={audioStore.selectedMenuTrackId}
        onSelect={id => audioStore.setSelectedTrack('menu', id)}
        previewTrackId={previewTrackId}
        onTogglePreview={togglePreview}
      />

      <View style={styles.divider} />

      {/* Ligne Ambiance Défi (ingame) */}
      <RowPicker
        typeLabel="Ambiance Défi"
        typeEmoji="🎮"
        enabled={audioStore.ingameEnabled}
        onToggle={audioStore.setIngameEnabled}
        tracks={ownedIngame}
        selectedId={audioStore.selectedIngameTrackId}
        onSelect={id => audioStore.setSelectedTrack('ingame', id)}
        previewTrackId={previewTrackId}
        onTogglePreview={togglePreview}
      />

      <View style={styles.divider} />

      {/* Volume */}
      <View style={styles.volumeRow}>
        <Text style={styles.volumeLabel}>🔉 Volume</Text>
        <View style={styles.volumeBtns}>
          {VOLUMES.map(v => (
            <TouchableOpacity
              key={v}
              style={[
                styles.volumeBtn,
                Math.abs(audioStore.volume - v) < 0.01 && styles.volumeBtnActive,
              ]}
              onPress={() => audioStore.setVolume(v)}
              activeOpacity={0.7}
            >
              <Text style={styles.volumeBtnText}>
                {v === 0 ? '🔇' : v === 1 ? '🔊' : `${Math.round(v * 100)}%`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Section "À débloquer" */}
      {lockedTracks.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.unlockTitle}>🛒 Titres disponibles</Text>
          {lockedTracks.map(track => {
            // La barre montre les graines disponibles du joueur / coût du titre
            const currentSeeds = Math.min(player.seeds, track.cost);
            const pct = track.cost > 0 ? currentSeeds / track.cost : 0;
            const canBuy = player.seeds >= track.cost;
            return (
              <View key={track.id} style={styles.lockedTrack}>
                <View style={styles.lockedTrackInfo}>
                  <Text style={styles.lockedTrackTitle}>{track.title}</Text>
                  <Text style={styles.lockedTrackType}>
                    {track.type === 'ingame' ? '🎮 Ambiance Défi' : '🌲 Ambiance Forêt'}
                  </Text>
                  {track.description && (
                    <Text style={styles.lockedTrackDesc}>{track.description}</Text>
                  )}
                </View>

                {/* Barre de progression : graines disponibles → 100 requises */}
                <View style={styles.progressRow}>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct * 100}%` as any },
                        canBuy && styles.progressFillReady,
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.min(player.seeds, track.cost)}/{track.cost} 🌱
                  </Text>
                </View>

                {/* Bouton achat — actif si le joueur a assez de graines */}
                <TouchableOpacity
                  style={[styles.buyBtn, !canBuy && styles.buyBtnDisabled]}
                  onPress={() => handleBuyTrack(track)}
                  activeOpacity={canBuy ? 0.8 : 1}
                  disabled={!canBuy}
                >
                  <Text style={styles.buyBtnText}>
                    {canBuy ? `🛒 Acheter (${track.cost} 🌱)` : `Il te faut ${track.cost} 🌱`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      {/* Modal déblocage musique */}
      <MusicUnlockModal
        visible={!!unlockModalTrackId}
        trackId={unlockModalTrackId}
        onClose={() => setUnlockModalTrackId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.ui.border,
  },
  volumeRow: {
    gap: 8,
  },
  volumeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.forest.dark,
  },
  volumeBtns: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  volumeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.ui.background,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  volumeBtnActive: {
    backgroundColor: Colors.forest.light + '20',
    borderColor: Colors.forest.medium,
  },
  volumeBtnText: {
    fontSize: 12,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  // Section titres verrouillés
  unlockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  lockedTrack: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  lockedTrackInfo: {
    gap: 2,
  },
  lockedTrackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  lockedTrackType: {
    fontSize: 11,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  lockedTrackDesc: {
    fontSize: 12,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.ui.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.forest.light,
    borderRadius: 4,
  },
  progressFillReady: {
    backgroundColor: Colors.forest.accent,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ui.textLight,
    minWidth: 60,
    textAlign: 'right',
  },
  buyBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: Colors.ui.border,
    opacity: 0.6,
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
