/**
 * lib/roles.js
 *
 * Author: Hasnain Malik
 *
 * Definerer alle brukerroller i systemet og hjelpefunksjoner for validering.
 *
 * Rollehierarki:
 *   USER        → Vanlig bruker (standard etter registrering)
 *   UTLEIER     → Hytteeier som kan opprette og administrere hytter
 *   TURLEDER    → Kan opprette og lede turforslag
 *   ADVERTISER  → Kan opprette annonser (reklamefunksjon)
 *   EDITOR      → Redaktørrolle for innholdsadministrasjon
 *   ADMIN       → Full tilgang til alle funksjoner og admin-panel
 *
 * SIGNUP_ROLES definerer hvilke roller brukere kan velge ved registrering.
 * ADMIN og EDITOR kan kun tildeles av en eksisterende administrator.
 */

// Alle tilgjengelige roller som strengkonstanter
export const ROLE_USER       = "USER";
export const ROLE_UTLEIER    = "UTLEIER";
export const ROLE_TURLEDER   = "TURLEDER";
export const ROLE_ADMIN      = "ADMIN";
export const ROLE_ADVERTISER = "ADVERTISER";
export const ROLE_EDITOR     = "EDITOR";

// Fullstendig liste over gyldige roller – brukes i isValidRole()
export const ALL_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_TURLEDER, ROLE_ADMIN, ROLE_ADVERTISER, ROLE_EDITOR];

// Roller tilgjengelige ved registrering – ADMIN og EDITOR kan ikke selv-tildeles
export const SIGNUP_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_TURLEDER, ROLE_ADVERTISER];

/**
 * Sjekker om en rolle er gyldig (finnes i ALL_ROLES).
 * Brukes typisk av admin-endepunkter som oppdaterer brukerroller.
 *
 * @param {string} role - Rolleverdien som skal valideres
 * @returns {boolean}
 */
export function isValidRole(role) {
  return ALL_ROLES.includes(String(role).toUpperCase());
}

/**
 * Sjekker om en rolle kan velges ved registrering (finnes i SIGNUP_ROLES).
 * Hindrer at brukere tildeler seg selv ADMIN- eller EDITOR-rollen.
 *
 * @param {string} role - Rolleverdien brukeren ønsker ved registrering
 * @returns {boolean}
 */
export function isSignupRole(role) {
  return SIGNUP_ROLES.includes(String(role).toUpperCase());
}
