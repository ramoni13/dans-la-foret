// ============================================================
// PAGE ADMIN — Séquence des badges (Ramoni only)
// Affiche et permet d'explorer la MASTER_SEQUENCE des badges.
// Modification en mémoire uniquement — pas de persistence Firestore.
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { MASTER_SEQUENCE, ELIGIBLE_GOAL_BADGE_IDS } from '../../src/core/engine/badgeEngine';
import { BADGE_MAP, BadgeRarity } from '../../src/constants/badges';
import { Colors } from '../../src/constants/colors';
import { usePlayerStore } from '../../src/store/playerStore';

// ── Couleurs par rareté ────────────────────────────────────────────────────────
const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    '#8B6914',
  pierre:  '#6B7280',
  or:      '#D97706',
  cristal: '#7C3AED',
};

// ── Composant ─────────────────────────────────────────────────────────────────

export default function BadgeSequenceAdminScreen() {
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const username = usePlayerStore(s => s.username);

  // Séquence modifiable en mémoire
  const [sequence, setSequence] = useState<string[]>(MASTER_SEQUENCE);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<BadgeRarity | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  // Garde admin
  if (username !== 'Ramoni') {
    return (
      <View style={styles.center}>
        <Text style={styles.forbidden}>Accès réservé à Ramoni.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Catégories disponibles
  const categories = useMemo(() => {
    const cats = new Set(sequence.map(id => BADGE_MAP[id]?.category ?? 'inconnu'));
    return Array.from(cats).sort();
  }, [sequence]);

  const rarities: BadgeRarity[] = ['bois', 'pierre', 'or', 'cristal'];

  // Séquence filtrée
  const displayedSequence = useMemo(() => {
    return sequence.filter(id => {
      const def = BADGE_MAP[id];
      if (!def) return false;
      if (filterCategory && def.category !== filterCategory) return false;
      if (filterRarity && def.rarity !== filterRarity) return false;
      return true;
    });
  }, [sequence, filterCategory, filterRarity]);

  // Partager/copier la séquence
  const handleCopy = useCallback(async () => {
    const json = JSON.stringify(sequence, null, 2);
    try {
      await Share.share({ message: json, title: 'MASTER_SEQUENCE' });
    } catch {
      // Fallback : affiche dans une alerte pour copier manuellement
      Alert.alert('Séquence JSON', json.slice(0, 500) + '...', [{ text: 'OK' }]);
    }
  }, [sequence]);

  // Importer depuis le champ texte
  const handleImport = useCallback(() => {
    setImportError('');
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error('Doit être un tableau JSON');
      const invalid = parsed.filter((id: string) => !BADGE_MAP[id]);
      if (invalid.length > 0) throw new Error(`IDs inconnus : ${invalid.join(', ')}`);
      setSequence(parsed);
      setImportText('');
      Alert.alert('Importé', `${parsed.length} badges chargés en mémoire.`);
    } catch (e: any) {
      setImportError(e.message ?? 'Erreur de parsing');
    }
  }, [importText]);

  // Réinitialiser
  const handleReset = useCallback(() => {
    setSequence(MASTER_SEQUENCE);
    setImportText('');
    setImportError('');
  }, []);

  // Rendu d'un badge
  const renderBadge = useCallback(({ item, index }: { item: string; index: number }) => {
    const def = BADGE_MAP[item];
    if (!def) return null;
    const globalIndex = sequence.indexOf(item);
    const isEligible = ELIGIBLE_GOAL_BADGE_IDS.includes(item);
    return (
      <View style={[styles.badgeRow, !isEligible && styles.badgeRowExcluded]}>
        <Text style={styles.badgeNum}>{globalIndex + 1}</Text>
        <Text style={styles.badgeEmoji}>{def.emoji}</Text>
        <View style={styles.badgeInfo}>
          <Text style={styles.badgeLabel}>{def.label}</Text>
          <Text style={styles.badgeMeta}>
            <Text style={[styles.badgeRarity, { color: RARITY_COLORS[def.rarity] }]}>
              {def.rarity}
            </Text>
            {'  ·  '}
            <Text style={styles.badgeCat}>{def.category}</Text>
            {!isEligible && <Text style={styles.badgeExcluded}>  · hors objectif</Text>}
          </Text>
        </View>
        <Text style={styles.badgeId}>{item}</Text>
      </View>
    );
  }, [sequence]);

  return (
    <View style={[styles.container, { paddingTop: safeInsets.top }]}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Séquence des badges</Text>
        <Text style={styles.count}>{sequence.length} badges</Text>
      </View>

      {/* Filtres catégorie */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, !filterCategory && styles.chipActive]}
          onPress={() => setFilterCategory(null)}
        >
          <Text style={[styles.chipText, !filterCategory && styles.chipTextActive]}>Toutes</Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, filterCategory === cat && styles.chipActive]}
            onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
          >
            <Text style={[styles.chipText, filterCategory === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtres rareté */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, !filterRarity && styles.chipActive]}
          onPress={() => setFilterRarity(null)}
        >
          <Text style={[styles.chipText, !filterRarity && styles.chipTextActive]}>Toutes raretés</Text>
        </TouchableOpacity>
        {rarities.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, filterRarity === r && styles.chipActive]}
            onPress={() => setFilterRarity(filterRarity === r ? null : r)}
          >
            <Text style={[styles.chipText, filterRarity === r && styles.chipTextActive, { color: RARITY_COLORS[r] }]}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      <FlatList
        data={displayedSequence}
        keyExtractor={item => item}
        renderItem={renderBadge}
        contentContainerStyle={styles.list}
        style={styles.flatList}
      />

      {/* Actions */}
      <View style={[styles.footer, { paddingBottom: safeInsets.bottom + 8 }]}>
        {/* Import */}
        <TextInput
          style={styles.importInput}
          placeholder='Coller le JSON de séquence ici...'
          placeholderTextColor='#666'
          value={importText}
          onChangeText={setImportText}
          multiline
          numberOfLines={3}
        />
        {importError ? <Text style={styles.importError}>{importError}</Text> : null}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleImport}>
            <Text style={styles.actionBtnText}>Importer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleCopy}>
            <Text style={styles.actionBtnText}>Copier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleReset}>
            <Text style={styles.actionBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1F0F',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1F0F',
  },
  forbidden: {
    color: '#F87171',
    fontSize: 18,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A1F',
  },
  closeBtn: {
    paddingRight: 12,
  },
  closeBtnText: {
    color: '#86EFAC',
    fontSize: 22,
  },
  title: {
    flex: 1,
    color: '#F0FDF4',
    fontSize: 17,
    fontWeight: '700',
  },
  count: {
    color: '#6EE7B7',
    fontSize: 13,
  },
  filterRow: {
    flexGrow: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A1F',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D5A2E',
    marginRight: 6,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#166534',
    borderColor: '#4ADE80',
  },
  chipText: {
    color: '#86EFAC',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#F0FDF4',
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2E1B',
  },
  badgeRowExcluded: {
    opacity: 0.5,
  },
  badgeNum: {
    color: '#4B5563',
    fontSize: 11,
    width: 26,
    textAlign: 'right',
    marginRight: 8,
  },
  badgeEmoji: {
    fontSize: 20,
    marginRight: 10,
    width: 28,
    textAlign: 'center',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  badgeMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  badgeRarity: {
    fontWeight: '600',
  },
  badgeCat: {
    color: '#6B7280',
  },
  badgeExcluded: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  badgeId: {
    color: '#374151',
    fontSize: 10,
    marginLeft: 8,
    maxWidth: 120,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#1E3A1F',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#0D1F0F',
  },
  importInput: {
    backgroundColor: '#111827',
    color: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#374151',
  },
  importError: {
    color: '#F87171',
    fontSize: 12,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#166534',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: '#1E3A5F',
  },
  actionBtnDanger: {
    backgroundColor: '#7F1D1D',
  },
  actionBtnText: {
    color: '#F0FDF4',
    fontSize: 13,
    fontWeight: '600',
  },
  backBtn: {
    backgroundColor: '#166534',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  backBtnText: {
    color: '#F0FDF4',
    fontSize: 14,
    fontWeight: '600',
  },
});
