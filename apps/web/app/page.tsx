import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import HowItWorksCarousel from "./HowItWorksCarousel";
import { HeroStage, HowSheet, RevealHeading } from "./HeroSheetTransition";
import { DemoZoomTransition } from "./DemoZoomTransition";
import PactDemo from "./PactDemo";
import PeopleSection from "./PeopleSection";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Pact home"><Image className="brand-logo brand-logo-light" src="/pact-primary-logo.svg" alt="Pact" width={132} height={40} priority /></a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a><a href="#for-everyone">For everyone</a><a href="#funding-demo">Try the demo</a>
        </nav>
        <div className="site-header-actions"><Link className="header-sign-in" href="/auth?intent=payee">Vendor sign in</Link><Link className="button button-primary button-small" href="/auth?intent=organizer">Start an event <ArrowRight aria-hidden="true" /></Link></div>
      </header>

      <main id="top">
        <HeroStage>
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <h1 id="hero-heading">Built for the people who make events work.</h1>
            <p className="hero-lede">Connect every funding source to every vendor milestone. Know what is funded, what is due, and where every dollar is going.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth?intent=organizer">Start an event <ArrowRight aria-hidden="true" /></Link>
              <Link className="button button-secondary-on-dark" href="/auth?intent=payee">Payee sign in</Link>
            </div>
          </div>
          <div className="hero-progress" aria-hidden="true">
            <span>01</span><span className="progress-line"><i /></span><span>04</span>
          </div>
        </section>
        </HeroStage>

        <HowSheet>
        <section id="how-it-works" className="process section-shell" aria-labelledby="process-heading">
          <div className="section-intro"><p className="eyebrow">How Pact works</p><RevealHeading id="process-heading" text="Turn your event budget into a live funding plan." /><p>Connect expected funding to real vendor milestones, then track each amount from commitment to payment.</p></div>
          <HowItWorksCarousel />
        </section>
        </HowSheet>

        <DemoZoomTransition>
          <PactDemo />
        </DemoZoomTransition>

        <PeopleSection />

        <section className="closing section-shell" aria-labelledby="closing-heading"><div><p className="eyebrow">See the financial state</p><h2 id="closing-heading">Find the funding gap before it becomes a crisis.</h2><p>Track every commitment, milestone, allocation, payment, and eligible refund in one place.</p></div><div className="closing-actions"><Link className="text-link" href="/auth?intent=payee">Vendor sign in <ArrowUpRight aria-hidden="true" /></Link><Link className="button button-primary" href="/auth?intent=organizer">Start an event <ArrowUpRight aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="site-footer section-shell"><a className="wordmark" href="#top" aria-label="Pact home"><Image className="brand-logo" src="/pact-primary-logo.svg" alt="Pact" width={132} height={40} /></a><p>Financial infrastructure for the money behind an event.</p><span>© 2026 Pact</span></footer>
    </>
  );
}
