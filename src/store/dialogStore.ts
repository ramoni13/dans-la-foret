// ============================================================
// DIALOGUES — remplacent Alert.alert / window.alert / window.confirm
//
// Un seul dialogue à la fois, affiché par `DialogHost` (monté UNE fois dans le layout racine) avec la modale
// `ConfirmModal` de l'app. Les écrans appellent `showAlert` / `showConfirm` sans rien savoir de la modale.
//
//   showAlert({ title, message })                        → un bouton « OK »
//   showConfirm({ title, message, onConfirm, ... })      → « Confirmer » + « Annuler »
//
// Contrainte : une `Modal` native ouverte masque celle du layout racine. Depuis un composant qui est LUI-MÊME dans
// une `Modal`, afficher `ConfirmModal` localement (voir AdminCleanModal) au lieu de passer par ce store.
// Une 2e demande pendant qu'un dialogue est ouvert est mise en file et affichée ensuite.
// ============================================================

import { create } from 'zustand';

export interface DialogRequest {
  title?: string;
  message: string;
  /** Emoji de l'en-tête (par défaut : ℹ️ pour une alerte, ⚠️ pour une confirmation). */
  icon?: string;
  /** Libellé du bouton principal. Absent : « OK » (alerte) ou « Confirmer » (confirmation). */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation (confirmation uniquement). Absent : « Annuler ». */
  cancelLabel?: string;
  /** Bouton principal rouge (action irréversible). */
  destructive?: boolean;
  /** Appelé quand le joueur confirme. */
  onConfirm?: () => void;
  /** Appelé quand le joueur annule ou ferme (confirmation uniquement). */
  onCancel?: () => void;
}

export interface DialogItem extends DialogRequest {
  id: number;
  /** `true` : une alerte (un seul bouton). */
  alertOnly: boolean;
}

interface DialogState {
  current: DialogItem | null;
  queue: DialogItem[];
  push: (item: DialogItem) => void;
  /** Ferme le dialogue courant et affiche le suivant de la file. */
  close: () => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  current: null,
  queue: [],
  push: (item) => {
    if (get().current) set(s => ({ queue: [...s.queue, item] }));
    else set({ current: item });
  },
  close: () => set(s => {
    const [next, ...rest] = s.queue;
    return { current: next ?? null, queue: rest };
  }),
}));

let nextId = 1;

/** Informe le joueur (un bouton « OK »). */
export function showAlert(request: DialogRequest | string): void {
  const req: DialogRequest = typeof request === 'string' ? { message: request } : request;
  useDialogStore.getState().push({ ...req, id: nextId++, alertOnly: true });
}

/** Demande une confirmation (« Confirmer » / « Annuler »). */
export function showConfirm(request: DialogRequest): void {
  useDialogStore.getState().push({ ...request, id: nextId++, alertOnly: false });
}
