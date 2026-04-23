export const ROLE_USER = "USER";
export const ROLE_UTLEIER = "UTLEIER";
export const ROLE_TURLEDER = "TURLEDER";
export const ROLE_ADMIN = "ADMIN";

export const ALL_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_TURLEDER, ROLE_ADMIN];
export const SIGNUP_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_TURLEDER];

export function isValidRole(role) {
  return ALL_ROLES.includes(String(role).toUpperCase());
}

export function isSignupRole(role) {
  return SIGNUP_ROLES.includes(String(role).toUpperCase());
}
