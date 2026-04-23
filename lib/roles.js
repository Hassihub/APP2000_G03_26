export const ROLE_USER = "USER";
export const ROLE_UTLEIER = "UTLEIER";
export const ROLE_TURLEDER = "TURLEDER";
export const ROLE_ADMIN = "ADMIN";
export const ROLE_ADVERTISER = "ADVERTISER";
export const ROLE_EDITOR = "EDITOR";

export const ALL_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_TURLEDER, ROLE_ADMIN, ROLE_ADVERTISER, ROLE_EDITOR];
export const SIGNUP_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_TURLEDER, ROLE_ADVERTISER];

export function isValidRole(role) {
  return ALL_ROLES.includes(String(role).toUpperCase());
}

export function isSignupRole(role) {
  return SIGNUP_ROLES.includes(String(role).toUpperCase());
}
