// ============================================================
// DEBUG STORE — logs visuels in-app (temporaire, à supprimer)
// ============================================================
import { create } from 'zustand';

interface DebugEntry {
  t: number;   // timestamp relatif en ms
  msg: string;
}

interface DebugState {
  entries: DebugEntry[];
  startT: number;
  log: (msg: string) => void;
  clear: () => void;
}

export const useDebugStore = create<DebugState>((set, get) => ({
  entries: [],
  startT: Date.now(),
  log: (msg) => {
    const elapsed = Date.now() - get().startT;
    set(s => ({
      entries: [...s.entries.slice(-30), { t: elapsed, msg }],
    }));
  },
  clear: () => set({ entries: [], startT: Date.now() }),
}));

export const dlog = (msg: string) => useDebugStore.getState().log(msg);
