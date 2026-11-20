// ============================================================
// MUSICPANEL — Pavé de gestion de la musique dans le Profil
//
// Structure :
//   - Ligne "Musique des menus"  (menu)  : toggle + listbox + play
//   - Ligne "Musique des défis"  (ingame): toggle + listbox + play
//   (pas de volume : le joueur règle le volume de son appareil)
//   - Cliquer un titre de la liste le sélectionne ET le préécoute (le précédent s'arrête)
//   - Section "Acheter" pour les titres verrouillés
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { AudioPlayer } from 'expo-audio';

import { Colors } from '../../constants/colors';
import { ForestColors } from '../../theme/forestTheme';
import { useAudioStore } from '../../store/audioStore';
import { showAlert } from '../../store/dialogStore';
import { usePlayerStore } from '../../store/playerStore';
import { MUSIC_CATALOG, MusicTrack } from '../../constants/music';
import { BADGE_MAP, getTrophyTexts } from '../../constants/badges';
import { getChapter } from '../../constants/progression';
import { audioService } from '../../services/audioService';
import { useT } from '../../i18n';
import { auth } from '../../services/firebase';
import { updateMusicSelection } from '../../services/playerService';

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
  onSelect: (track: MusicTrack) => void;
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
                onPress={() => onSelect(t)}
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
            onPress={() => onTogglePreview(selectedTrack)}
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
    backgroundColor: ForestColors.parchmentLight,
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
    backgroundColor: ForestColors.parchmentLight,
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
  const t = useT();
  const audioStore  = useAudioStore();
  const player      = usePlayerStore();

    // Preview en cours (expo-audio AudioPlayer instance)
  const previewSoundRef    = useRef<AudioPlayer | null>(null);
  const previewTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  // Note : le modal de déblocage musique est géré globalement dans app/_layout.tsx
  // via audioStore.pendingMusicUnlockTrackId — plus besoin de détection locale ici.

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
  // `previewSeqRef` identifie la demande de préécoute en cours : toute nouvelle demande (ou un arrêt) l'incrémente,
  // ce qui invalide les lectures encore en cours de démarrage (clics rapides dans la liste).
  const previewSeqRef = useRef(0);

  /** Coupe le son de préécoute en cours (synchrone, sans toucher à l'état d'affichage). */
  const releasePreviewSound = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewSoundRef.current) {
      const s = previewSoundRef.current;
      previewSoundRef.current = null;
      // Déléguer l'arrêt propre au service (gère le bug web ontimeupdate)
      audioService.stopPreviewSound(s).catch(() => {});
    }
  };

  const stopPreview = () => {
    previewSeqRef.current += 1;
    releasePreviewSound();
    setPreviewTrackId(null);
    // Signaler au store que le preview est terminé (reprend la musique principale)
    audioStore.setPreviewTrack(null);
  };

  /** Lance la préécoute d'un titre ; celle du titre précédent est arrêtée immédiatement. */
  const startPreview = async (track: MusicTrack) => {
    const seq = ++previewSeqRef.current;
    releasePreviewSound();

    // Signaler au AudioController qu'un preview démarre (pause la musique principale)
    audioStore.setPreviewTrack(track.id);
    setPreviewTrackId(track.id);

    const sound = await audioService.playPreview(track.file);
    if (seq !== previewSeqRef.current) {
      // Une autre demande est arrivée pendant le démarrage : ce son ne doit pas rester audible
      if (sound) audioService.stopPreviewSound(sound).catch(() => {});
      return;
    }
    if (!sound) {
      stopPreview();
      return;
    }
    previewSoundRef.current = sound;

    // expo-audio : écouter la fin de lecture via addListener
    if (Platform.OS !== 'web') {
      sound.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish && seq === previewSeqRef.current) stopPreview();
      });
    }

    // Timer de sécurité : arrêt auto après 30 secondes de preview max
    previewTimerRef.current = setTimeout(() => {
      if (seq === previewSeqRef.current) stopPreview();
    }, 30_000);
  };

  const togglePreview = (track: MusicTrack) => {
    if (previewTrackId === track.id) stopPreview();
    else startPreview(track).catch(() => {});
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      previewSeqRef.current += 1;
      releasePreviewSound();
      audioStore.setPreviewTrack(null);
    };
  }, []);

  /** Clic sur un titre de la liste : il devient le titre choisi ET on l'entend (le précédent s'arrête). */
  const handlePickTrack = (type: 'ingame' | 'menu', track: MusicTrack) => {
    handleSelectTrack(type, track.id);
    togglePreview(track);
  };
  // ── Sélection de piste avec persistance Firestore ─────────
  const handleSelectTrack = (type: 'ingame' | 'menu', trackId: string) => {
    audioStore.setSelectedTrack(type, trackId);
    // Persistance Firestore en arrière-plan (si connecté, non anonyme)
    const uid    = auth.currentUser?.uid;
    const isAnon = auth.currentUser?.isAnonymous ?? true;
    if (uid && !isAnon) {
      const a = useAudioStore.getState();
      const ingame = type === 'ingame' ? trackId : a.selectedIngameTrackId;
      const menu   = type === 'menu'   ? trackId : a.selectedMenuTrackId;
      updateMusicSelection(uid, ingame, menu).catch(() => {});
    }
  };

  // ── Condition de déblocage d'un titre (Progression v2, C8 / D11) ─────────────
  // Un titre est débloqué par la fin d'un chapitre, ou par un trophée précis (palier « pierre » de 5 séries).
  /** true si le joueur remplit déjà la condition du titre (chapitre terminé ou trophée obtenu). */
  const isUnlockMet = (track: MusicTrack): boolean => {
    const u = track.unlock;
    if (!u) return true;
    if (u.type === 'chapter') return player.levelsCompleted >= u.chapter * 3;
    if (u.type === 'trophy') return player.earnedBadges.includes(u.id);
    return false; // « graines » : prévu pour plus tard, jamais rempli tout seul
  };

  /** Libellé de la condition : « Fin du chapitre N » ou « Trophée : … ». */
  const describeUnlock = (track: MusicTrack): { emoji: string; label: string; detail?: string } | null => {
    const u = track.unlock;
    if (!u) return null;
    if (u.type === 'chapter') {
      const chapter = getChapter(u.chapter);
      return {
        emoji: chapter?.emoji ?? '🔒',
        label: t('music_unlock_chapter', { chapter: String(u.chapter) }),
        detail: chapter ? t(chapter.nameKey) : undefined,
      };
    }
    if (u.type === 'trophy') {
      const def = BADGE_MAP[u.id];
      if (!def) return null;
      const texts = getTrophyTexts(def, player.language, t);
      return { emoji: def.emoji, label: t('music_unlock_trophy', { trophy: texts.label }), detail: texts.description };
    }
    return { emoji: '🌱', label: t('music_unlock_seeds', { cost: String(u.cost) }) };
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{t('music_panel_title')}</Text>

      {/* Ligne Musique des menus */}
      <RowPicker
        typeLabel={t('music_type_menu')}
        typeEmoji="🌲"
        enabled={audioStore.menuEnabled}
        onToggle={audioStore.setMenuEnabled}
        tracks={ownedMenu}
        selectedId={audioStore.selectedMenuTrackId}
        onSelect={track => handlePickTrack('menu', track)}
        previewTrackId={previewTrackId}
        onTogglePreview={togglePreview}
      />

      <View style={styles.divider} />

      {/* Ligne Musique des défis (ingame) */}
      <RowPicker
        typeLabel={t('music_type_ingame')}
        typeEmoji="🎮"
        enabled={audioStore.ingameEnabled}
        onToggle={audioStore.setIngameEnabled}
        tracks={ownedIngame}
        selectedId={audioStore.selectedIngameTrackId}
        onSelect={track => handlePickTrack('ingame', track)}
        previewTrackId={previewTrackId}
        onTogglePreview={togglePreview}
      />

      {/* ── Réactiver les aides bonus ── */}
      <View style={styles.divider} />
      <TouchableOpacity
        style={styles.resetTutorialsBtn}
        onPress={() => {
          player.resetBonusTutorials();
          showAlert({ icon: '💡', message: t('settings_reset_tutorials_done') });
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.resetTutorialsIcon}>💡</Text>
        <Text style={styles.resetTutorialsText}>{t('settings_reset_tutorials')}</Text>
      </TouchableOpacity>

      {/* Section "Titres verrouillés" — déblocage par badge spécifique */}
      {lockedTracks.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.unlockTitle}>{t('music_locked_section')}</Text>
          {lockedTracks.map(track => {
            const requirement = describeUnlock(track);
            const alreadyHas = isUnlockMet(track);
            return (
              <View key={track.id} style={styles.lockedTrack}>
                {/* En-tête : titre + type */}
                <View style={styles.lockedTrackInfo}>
                  <Text style={styles.lockedTrackTitle}>🔒 {track.title}</Text>
                  <Text style={styles.lockedTrackType}>
                    {track.type === 'ingame' ? `🎮 ${t('music_type_ingame')}` : `🌲 ${t('music_type_menu')}`}
                  </Text>
                  {track.description && (
                    <Text style={styles.lockedTrackDesc}>{track.description}</Text>
                  )}
                </View>

                {/* Condition de déblocage : fin de chapitre ou trophée */}
                {requirement && (
                  <View style={[
                    styles.badgeRequirementRow,
                    alreadyHas && styles.badgeRequirementRowDone,
                  ]}>
                    <Text style={styles.badgeRequirementEmoji}>{requirement.emoji}</Text>
                    <View style={styles.badgeRequirementTextBlock}>
                      <Text style={[
                        styles.badgeRequirementLabel,
                        alreadyHas && styles.badgeRequirementLabelDone,
                      ]}>
                        {alreadyHas ? t('music_badge_earned') : requirement.label}
                      </Text>
                      {!alreadyHas && !!requirement.detail && (
                        <Text style={styles.badgeRequirementDesc} numberOfLines={2}>
                          {requirement.detail}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: ForestColors.parchmentBase,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ForestColors.parchmentBorder,
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
  // Section titres verrouillés
  unlockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  lockedTrack: {
    backgroundColor: ForestColors.parchmentLight,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    opacity: 0.85,
  },
  lockedTrackInfo: {
    gap: 2,
  },
  lockedTrackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ui.textLight,
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
  badgeRequirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.forest.dark + '0D',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.forest.dark + '20',
  },
  badgeRequirementRowDone: {
    backgroundColor: Colors.forest.accent + '18',
    borderColor: Colors.forest.accent + '50',
  },
  badgeRequirementEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  badgeRequirementTextBlock: {
    flex: 1,
    gap: 2,
  },
  badgeRequirementLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  badgeRequirementLabelDone: {
    color: Colors.forest.accent,
  },
  badgeRequirementDesc: {
    fontSize: 11,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  // ── Réactiver les aides bonus ──
  resetTutorialsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  resetTutorialsIcon: {
    fontSize: 18,
  },
  resetTutorialsText: {
    fontSize: 14,
    color: Colors.forest.light,
    fontWeight: '600',
  },
});
