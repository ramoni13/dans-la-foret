// ============================================================
// starTones — notes du pop des étoiles, générées en mémoire (Progression v2, C7)
//
// Le dépôt n'embarque aucun son d'effet et `assets/` ne doit pas être modifié à la main :
// les 3 notes (de plus en plus aiguës) sont synthétisées en WAV 16 bits mono, puis
// encodées en URI `data:` base64.
//
// Fichier PUR (aucune dépendance React / Expo) : testé par __tests__/starTones.test.ts.
// ============================================================

export const STAR_TONE_SAMPLE_RATE = 22050;
export const STAR_TONE_DURATION_S = 0.32;

/** Fréquences (Hz) des 3 notes : do6, mi6, sol6 — arpège majeur montant. */
export const STAR_TONE_FREQUENCIES = [1046.5, 1318.5, 1568.0] as const;

/** Corps d'un fichier WAV PCM 16 bits mono (en-tête RIFF de 44 octets inclus). */
export function buildWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // taille du bloc fmt
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // débit en octets / s
  view.setUint16(32, 2, true);           // alignement de bloc
  view.setUint16(34, 16, true);          // bits par échantillon
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return new Uint8Array(buffer);
}

/**
 * Note de type « clochette » : sinus + 2e harmonique, attaque de 5 ms, décroissance exponentielle.
 * Amplitude limitée à 0.6 pour éviter toute saturation.
 */
export function synthesizeTone(
  frequency: number,
  durationS = STAR_TONE_DURATION_S,
  sampleRate = STAR_TONE_SAMPLE_RATE,
): Int16Array {
  const n = Math.max(1, Math.floor(durationS * sampleRate));
  const out = new Int16Array(n);
  const attack = Math.max(1, Math.floor(0.005 * sampleRate));
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / attack) * Math.exp(-6 * (i / n));
    const wave = Math.sin(2 * Math.PI * frequency * t) + 0.35 * Math.sin(4 * Math.PI * frequency * t);
    out[i] = Math.round((wave / 1.35) * env * 0.6 * 32767);
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 (RFC 4648, avec bourrage `=`), sans dépendre de `btoa` ni de `Buffer`. */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

/** URI `data:audio/wav;base64,...` de la note `index` (0, 1 ou 2). Hors plage → la dernière. */
export function getStarToneDataUri(index: number): string {
  const i = Math.max(0, Math.min(STAR_TONE_FREQUENCIES.length - 1, Math.floor(index)));
  const wav = buildWav(synthesizeTone(STAR_TONE_FREQUENCIES[i]), STAR_TONE_SAMPLE_RATE);
  return `data:audio/wav;base64,${toBase64(wav)}`;
}
