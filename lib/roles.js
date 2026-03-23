export const ROLE_USER = "USER";
export const ROLE_UTLEIER = "UTLEIER";
export const ROLE_ADMIN = "ADMIN";

export const ALL_ROLES = [ROLE_USER, ROLE_UTLEIER, ROLE_ADMIN];
export const SIGNUP_ROLES = [ROLE_USER, ROLE_UTLEIER];

export function isValidRole(role) {
  return ALL_ROLES.includes(String(role).toUpperCase());
}

export function isSignupRole(role) {
  return SIGNUP_ROLES.includes(String(role).toUpperCase());
}
