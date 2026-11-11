// ============================================================
// BoardSummary — Résumé du défi (dernière page de TOUS les briefings :
// Solo, Journalier, Forestier)
//
// Structure (lecture de haut en bas, une information par bloc) :
//   1. Titre (+ sous-titre optionnel : grille, ligue…)
//   2. Deux tuiles chiffrées : cases déjà posées / cases à remplir
//      + frise de la grille (pleine = posée, pointillée = à remplir)
//   3. Inventaire : les jetons à placer (badge ×N) puis ceux déjà posés
//   4. Rappels du mode (children : `BriefingNotes`), optionnels
//
// Les chiffres sont lus dans le défi lui-même (fixedPlacements et
// availableTokens), jamais dans les métadonnées du niveau.
// Fond des briefings : vert très sombre → tout le texte est clair.
// ============================================================

import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { Challenge } from '../../core/models/Challenge';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';

interface BoardSummaryProps {
  challenge: Challenge;
  /** Titre de la page (défaut : « Ce défi »). */
  title?: string;
  /** Ligne sous le titre (nom de la grille, ligue…). */
  subtitle?: string;
  /** Couleur d'accent du mode (chiffres, pointillés, badges ×N). */
  accent?: string;
  /** Couleur du titre (défaut : blanc). */
  titleColor?: string;
  isExpertMode?: boolean;
  /** Rappels propres au mode, affichés sous l'inventaire. */
  children?: React.ReactNode;
}

const TOKEN_SIZE = 64;
const TOKEN_SIZE_FIXED = 52;

interface InventoryEntry {
  elementId: string;
  count: number;
}

const TokenTile: React.FC<{
  entry: InventoryEntry;
  size: number;
  label: string;
  accent: string;
  dimmed?: boolean;
}> = ({ entry, size, label, accent, dimmed }) => {
  const def = ElementRegistry[entry.elementId];
  if (!def) return null;
  const a11y = entry.count > 1 ? `${entry.count} × ${label}` : label;
  return (
    <View style={[styles.tokenTile, { width: size + 32 }]} accessible accessibilityLabel={a11y}>
      <View>
        <View
          style={[
            styles.tokenCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: def.color,
              opacity: dimmed ? 0.8 : 1,
            },
          ]}
        >
          <Image
            source={typeof def.icon === 'string' ? { uri: def.icon } : def.icon}
            style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41 }}
            resizeMode="contain"
          />
        </View>
        {entry.count > 1 && (
          <View style={[styles.countBadge, { backgroundColor: accent }]}>
            <Text style={styles.countBadgeText}>×{entry.count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.tokenLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/** Ligne de rappel (icône + texte), partagée par les récapitulatifs de tous les modes. */
export const BriefingNotes: React.FC<{ items: { icon: string; text: string }[] }> = ({ items }) => (
  <View style={styles.notesBox}>
    {items.map((item, i) => (
      <View key={i} style={styles.noteRow}>
        <Text style={styles.noteIcon} importantForAccessibility="no">
          {item.icon}
        </Text>
        <Text style={styles.noteText}>{item.text}</Text>
      </View>
    ))}
  </View>
);

export const BoardSummary: React.FC<BoardSummaryProps> = ({
  challenge,
  title,
  subtitle,
  accent = Colors.forest.accent,
  titleColor = '#FFFFFF',
  isExpertMode = false,
  children,
}) => {
  const t = useT();

  const { toPlace, fixed, toPlaceCount, fixedCount, totalCells } = React.useMemo(() => {
    const toPlaceList: InventoryEntry[] = challenge.availableTokens
      .filter(tk => tk.count > 0)
      .map(tk => ({ elementId: tk.elementId, count: tk.count }));

    const fixedMap = new Map<string, number>();
    challenge.fixedPlacements.forEach(fp =>
      fixedMap.set(fp.elementId, (fixedMap.get(fp.elementId) ?? 0) + 1),
    );
    const fixedList: InventoryEntry[] = Array.from(fixedMap, ([elementId, count]) => ({
      elementId,
      count,
    }));

    const placeCount = toPlaceList.reduce((s, e) => s + e.count, 0);
    const fxCount = challenge.fixedPlacements.length;
    return {
      toPlace: toPlaceList,
      fixed: fixedList,
      toPlaceCount: placeCount,
      fixedCount: fxCount,
      totalCells: placeCount + fxCount,
    };
  }, [challenge]);

  const labelOf = (id: string) => {
    const key = `rules_element_${id}`;
    const translated = t(key);
    return translated === key ? ElementRegistry[id]?.label ?? id : translated;
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={styles.inner}
        accessibilityRole="summary"
        accessibilityLabel={t('briefing_recap_a11y', {
          total: String(totalCells),
          fixed: String(fixedCount),
          empty: String(toPlaceCount),
        })}
      >
        <Text style={[styles.title, { color: titleColor }]} accessibilityRole="header">
          {title ?? t('briefing_recap_title')}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* ── Tuiles chiffrées ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, styles.statTileFixed]}>
            <Text style={styles.statValue}>{fixedCount}</Text>
            <Text style={styles.statLabel}>{t('briefing_recap_fixed')}</Text>
          </View>
          <View style={[styles.statTile, styles.statTileEmpty, { borderColor: accent }]}>
            <Text style={[styles.statValue, { color: accent }]}>{toPlaceCount}</Text>
            <Text style={styles.statLabel}>{t('briefing_recap_to_place')}</Text>
          </View>
        </View>

        {/* ── Frise de la grille ── */}
        <View style={styles.strip} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: totalCells }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stripCell,
                i < fixedCount ? styles.stripCellFixed : [styles.stripCellEmpty, { borderColor: accent }],
              ]}
            />
          ))}
        </View>
        <Text style={styles.stripCaption}>
          {t('briefing_recap_total', { total: String(totalCells) })}
        </Text>

        {/* ── Inventaire à placer ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('briefing_recap_inventory')}</Text>
          <View style={styles.tokensRow}>
            {toPlace.map(entry => (
              <TokenTile
                key={`p-${entry.elementId}`}
                entry={entry}
                size={TOKEN_SIZE}
                label={labelOf(entry.elementId)}
                accent={accent}
              />
            ))}
          </View>
        </View>

        {/* ── Déjà posés ── */}
        {fixed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('briefing_recap_fixed_tokens')}</Text>
            <View style={styles.tokensRow}>
              {fixed.map(entry => (
                <TokenTile
                  key={`f-${entry.elementId}`}
                  entry={entry}
                  size={TOKEN_SIZE_FIXED}
                  label={labelOf(entry.elementId)}
                  accent={accent}
                  dimmed
                />
              ))}
            </View>
          </View>
        )}

        {children}

        {isExpertMode && (
          <View style={styles.expertBadge}>
            <Text style={styles.expertText}>{t('label_expert')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  inner: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 420,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: -8,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  statTileFixed: {
    backgroundColor: 'rgba(74,124,89,0.35)',
    borderColor: Colors.forest.light,
  },
  statTileEmpty: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  statValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    maxWidth: 320,
  },
  stripCell: {
    width: 26,
    height: 26,
    borderRadius: 7,
  },
  stripCellFixed: {
    backgroundColor: Colors.forest.light,
  },
  stripCellEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stripCaption: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: -6,
  },

  section: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
  },
  tokensRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tokenTile: {
    alignItems: 'center',
    gap: 4,
  },
  tokenCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 3,
  },
  countBadge: {
    position: 'absolute',
    right: -8,
    bottom: -4,
    minWidth: 30,
    paddingHorizontal: 6,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.forest.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  notesBox: {
    width: '100%',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noteIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  noteText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: '#FFFFFF',
  },

  expertBadge: {
    backgroundColor: 'rgba(255,193,7,0.18)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.6)',
  },
  expertText: {
    fontSize: 14,
    color: '#FFD54F',
    fontWeight: '700',
  },
});
