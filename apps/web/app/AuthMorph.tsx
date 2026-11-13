import { ViewTransition, type ReactNode } from "react";

/**
 * Landing hero <-> sign-in page transition.
 *
 * Elements that exist on both pages share a view-transition name and morph into each other:
 * the hero becomes the dark brand panel, the hero headline and lede glide into the panel copy,
 * the header logo moves into the panel, and the hero "Start an event" button becomes
 * "Continue with email". Morphs only play for navigations tagged with these types, so no other
 * route in the app is affected. Styling lives in story.css (`.pact-morph-*`).
 */
export const TO_AUTH = "to-auth";
export const FROM_AUTH = "from-auth";
/** Added only by the hero's primary CTA, so only that button morphs into the sign-in button. */
export const FROM_HERO_CTA = "from-hero-cta";

export const toAuthTypes = [TO_AUTH];
export const heroCtaTypes = [TO_AUTH, FROM_HERO_CTA];
export const fromAuthTypes = [FROM_AUTH];

type Part = "stage" | "logo" | "headline" | "lede" | "cta";

export function AuthMorph({ part, children }: { part: Part; children: ReactNode }) {
  const className = `pact-morph-${part === "headline" || part === "lede" ? "text" : part}`;
  const share: Record<string, string> & { default: string } = part === "cta"
    ? { [FROM_HERO_CTA]: className, [FROM_AUTH]: className, default: "none" }
    : { [TO_AUTH]: className, [FROM_AUTH]: className, default: "none" };
  return <ViewTransition name={`pact-auth-${part}`} share={share} default="none">{children}</ViewTransition>;
}
