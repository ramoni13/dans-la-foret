// ============================================================
// INFORMATIONS LÉGALES — source unique (éditeur, contact, URLs des pages légales)
//
// Les pages elles-mêmes sont des fichiers statiques du dossier `Site/` (hébergé chez OVH sous LEGAL_BASE_URL) :
//   confidentialite.html, cgu.html, mentions-legales.html, suppression-compte.html.
// Ces URLs sont aussi celles à déclarer dans App Store Connect et la Google Play Console.
//
// Fichier PUR (aucune dépendance React / Firebase) : testé par __tests__/accountDeletion.test.ts.
// ============================================================

export const LEGAL_PUBLISHER = {
  name: 'KROMIA',
  legalForm: 'SAS',
  siret: '107 542 201 00010',
  address: '2 rue d’Auriol, 13790 Peynier, France',
  website: 'https://www.studio-kromia.com',
} as const;

/** Adresse unique de contact (questions, exercice des droits RGPD, suppression de compte). */
export const CONTACT_EMAIL = 'contact@studio-kromia.com';

/** Racine publique des pages légales (dossier `Site/`), sans barre finale. */
export const LEGAL_BASE_URL = 'https://www.studio-kromia.com/danslaforet';

/** Version des textes légaux : à incrémenter à chaque modification substantielle des pages. */
export const LEGAL_TEXTS_VERSION = '2026-11-08';

export type LegalPage = 'privacy' | 'terms' | 'legal_notice' | 'account_deletion';

const LEGAL_PAGE_FILES: Readonly<Record<LegalPage, string>> = {
  privacy: 'confidentialite.html',
  terms: 'cgu.html',
  legal_notice: 'mentions-legales.html',
  account_deletion: 'suppression-compte.html',
};

/** URL publique d'une page légale. */
export function getLegalUrl(page: LegalPage): string {
  return `${LEGAL_BASE_URL}/${LEGAL_PAGE_FILES[page]}`;
}

/** Nom du fichier d'une page légale dans `Site/`. */
export function getLegalFile(page: LegalPage): string {
  return LEGAL_PAGE_FILES[page];
}

export const LEGAL_PAGES: readonly LegalPage[] = ['privacy', 'terms', 'legal_notice', 'account_deletion'];

/** Lien `mailto:` vers le contact, avec un objet prérempli. */
export function buildContactMailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
