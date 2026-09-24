/**
 * Patch runtime pour ExponentAV.web.js (expo-av)
 *
 * PROBLÈME : `loadForSound` installe `media.ontimeupdate` qui appelle
 * `DeviceEventEmitter.emit(...)`. Quand le son est libéré via `unloadAsync()`,
 * `element.load()` (dans `unloadForSound`) peut re-déclencher `ontimeupdate`
 * sur un émetteur dans un état invalide → crash "Cannot read properties of
 * undefined (reading 'emit')".
 *
 * SOLUTION DOUBLE :
 *  1. Patch `unloadForSound` : met `element.ontimeupdate = null` AVANT
 *     de faire `element.load()` (qui retriggère des events DOM).
 *  2. Patch `loadForSound` : enveloppe `ontimeupdate` dans un try/catch +
 *     auto-neutralisation si src est vide.
 *
 * Ce fichier est importé une seule fois depuis app/_layout.tsx.
 * Metro choisit automatiquement .web.ts sur web, .ts (stub) sur natif.
 */

// On importe le même singleton qu'utilise Sound.js d'expo-av.
// Le module system (Metro) garantit que c'est le même objet.
// L'import par chemin relatif vers node_modules est résolu par Metro.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExponentAV = require('expo-av/build/ExponentAV.web').default;

if (ExponentAV) {
  // ─── Patch unloadForSound ────────────────────────────────────────────────
  // Neutralise les handlers DOM AVANT de toucher src/load (évite le retrigger)
  const _origUnload = ExponentAV.unloadForSound?.bind(ExponentAV);
  if (_origUnload) {
    ExponentAV.unloadForSound = async function (element: HTMLAudioElement) {
      try {
        element.ontimeupdate    = null;
        element.onerror         = null;
        element.onended         = null;
        element.oncanplaythrough = null;
        element.onstalled       = null;
        element.onwaiting       = null;
      } catch (_) { /* ignoré */ }
      return _origUnload(element);
    };
  }

  // ─── Patch loadForSound ──────────────────────────────────────────────────
  // Enveloppe ontimeupdate dans un try/catch + auto-neutralisation
  const _origLoad = ExponentAV.loadForSound?.bind(ExponentAV);
  if (_origLoad) {
    ExponentAV.loadForSound = async function (
      nativeSource: any,
      fullInitialStatus: any
    ): Promise<[HTMLAudioElement, any]> {
      const [media, status] = await _origLoad(nativeSource, fullInitialStatus);

      // L'original a déjà installé media.ontimeupdate — on le wrappe
      const installedHandler = media.ontimeupdate;
      media.ontimeupdate = function (this: HTMLAudioElement, evt: Event) {
        try {
          // Auto-neutralisation si l'élément a été libéré (src vide)
          if (!this.src || this.src === window.location.href) {
            this.ontimeupdate = null;
            return;
          }
          if (installedHandler) {
            (installedHandler as EventListener).call(this, evt);
          }
        } catch {
          // En cas d'erreur (ex: DeviceEventEmitter undefined) → se couper
          this.ontimeupdate = null;
        }
      };

      return [media, status];
    };
  }
}

export {};
