export type AuthIntent = "organizer" | "payee";

export function destinationForAuthIntent(intent: AuthIntent): string {
  return intent === "payee" ? "/agreements" : "/dashboard";
}

const LAST_INTENT_KEY = "pact:last-auth-intent";

/** Remember which side the user signed in as, so the landing page can send them back to the right home. */
export function rememberAuthIntent(intent: AuthIntent) {
  try { window.localStorage.setItem(LAST_INTENT_KEY, intent); } catch { /* storage unavailable: fall back to organizer */ }
}

export function rememberedAuthIntent(): AuthIntent | null {
  try {
    const value = window.localStorage.getItem(LAST_INTENT_KEY);
    return value === "payee" || value === "organizer" ? value : null;
  } catch { return null; }
}
