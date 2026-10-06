export type AuthIntent = "organizer" | "payee";

export function destinationForAuthIntent(intent: AuthIntent): string {
  return intent === "payee" ? "/agreements" : "/events/new";
}
