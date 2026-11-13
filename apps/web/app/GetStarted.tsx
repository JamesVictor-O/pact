"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { AuthMorph, heroCtaTypes, toAuthTypes } from "./AuthMorph";
import { usePactAuth } from "./components/PactAuthProvider";
import { destinationForAuthIntent, rememberedAuthIntent } from "../lib/auth-routing";

type Role = "organizer" | "payee";

const SIDES: ReadonlyArray<{ role: Role; index: string; label: string; lines: [string, string]; body: string; cta: string; image: string; position: string; types: string[] }> = [
  { role: "organizer", index: "01", label: "For organizers", lines: ["I’m running", "an event."], body: "Plan where the money comes from, sign payment agreements, and pay everyone who makes it happen.", cta: "Continue as organizer", image: "/for-organizers.png", position: "40% 50%", types: heroCtaTypes },
  { role: "payee", index: "02", label: "For payees", lines: ["I’m getting", "paid."], body: "Review what you agreed, see when each payment is funded, and receive it to your own account.", cta: "Continue as payee", image: "/for-vendors.png", position: "45% 50%", types: toAuthTypes },
];

/**
 * The hero's single entry point. "Get started" opens a full-screen split: two photographic halves, one per
 * role. Hovering a side widens it; choosing one sweeps it across the screen before handing over to sign-in.
 */
/** Where a signed-in visitor's "Dashboard" button goes: the home of the side they last signed in as. */
function useSignedInHome() {
  const { user } = usePactAuth();
  const [home, setHome] = useState("/dashboard");
  useEffect(() => { setHome(destinationForAuthIntent(rememberedAuthIntent() ?? "organizer")); }, [user]);
  return user ? home : null;
}

/** Header actions: sign-in links for visitors, a single Dashboard link once signed in. */
export function HeaderActions() {
  const home = useSignedInHome();
  if (home) return <div className="site-header-actions"><Link className="button button-primary button-small" href={home}>Dashboard <ArrowRight aria-hidden="true" /></Link></div>;
  return <div className="site-header-actions"><Link className="header-sign-in" href="/auth?intent=payee" transitionTypes={toAuthTypes}>Vendor sign in</Link><Link className="button button-primary button-small" href="/auth?intent=organizer" transitionTypes={toAuthTypes}>Start an event <ArrowRight aria-hidden="true" /></Link></div>;
}

export function GetStarted() {
  const home = useSignedInHome();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<Role | null>(null);
  const router = useRouter();
  const reduceMotion = useReducedMotion() === true;

  const open = () => { setChosen(null); dialogRef.current?.showModal(); };
  const close = () => dialogRef.current?.close();
  const prefetch = () => { router.prefetch("/auth?intent=organizer"); router.prefetch("/auth?intent=payee"); };

  const choose = (event: MouseEvent<HTMLAnchorElement>, side: (typeof SIDES)[number]) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // let new-tab clicks through
    event.preventDefault();
    if (chosen) return;
    setChosen(side.role);
    const go = () => router.push(`/auth?intent=${side.role}`, { transitionTypes: side.types });
    if (reduceMotion) go(); else window.setTimeout(go, 520);
  };

  if (home) return <Link className="button button-primary hero-get-started" href={home}>Dashboard <ArrowRight aria-hidden="true" /></Link>;

  return <>
    <AuthMorph part="cta">
      <button type="button" className="button button-primary hero-get-started" onClick={open} onPointerEnter={prefetch} onFocus={prefetch} aria-haspopup="dialog">Get started <ArrowRight aria-hidden="true" /></button>
    </AuthMorph>
    <dialog ref={dialogRef} className={`role-split${chosen ? ` has-choice chose-${chosen}` : ""}`} aria-labelledby="role-split-title">
      <h2 id="role-split-title" className="role-split-title" tabIndex={-1} autoFocus>How will you use Pact?</h2>
      <button type="button" className="role-split-close" onClick={close}><span>Close</span><X aria-hidden="true" /></button>
      <div className="role-split-sides">
        {SIDES.map(side => (
          <a key={side.role} href={`/auth?intent=${side.role}`} className={`role-side role-side-${side.role}${chosen === side.role ? " is-chosen" : ""}`} onClick={event => choose(event, side)} aria-label={`${side.lines.join(" ")} ${side.cta}`}>
            <span className="role-side-photo" aria-hidden="true"><Image src={side.image} alt="" fill sizes="(max-width: 768px) 100vw, 70vw" style={{ objectPosition: side.position }} /></span>
            <span className="role-side-veil" aria-hidden="true" />
            <span className="role-side-meta" aria-hidden="true"><span>{side.index}</span><span>{side.label}</span></span>
            <span className="role-side-copy" aria-hidden="true">
              <span className="role-side-heading">{side.lines.map(line => <span className="role-side-line" key={line}><span>{line}</span></span>)}</span>
              <span className="role-side-detail">
                <span className="role-side-detail-inner">
                  <span className="role-side-body">{side.body}</span>
                  <span className="role-side-cta">{side.cta}<span className="role-side-arrow"><ArrowRight /></span></span>
                </span>
              </span>
            </span>
          </a>
        ))}
      </div>
    </dialog>
  </>;
}
