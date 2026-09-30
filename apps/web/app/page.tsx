import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
        <div className="site-header-actions"><Link className="header-sign-in" href="/auth?intent=payee">Vendor sign in</Link><Link className="button button-primary button-small" href="/auth?intent=organizer">Create an event Pact <ArrowRight aria-hidden="true" /></Link></div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <h1 id="hero-heading">Built for the people who make events work.</h1>
            <p className="hero-lede">Connect every funding source to every vendor milestone. Know what is funded, what is due, and where every dollar is going.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth?intent=organizer">Create an event Pact <ArrowRight aria-hidden="true" /></Link>
              <Link className="button button-secondary-on-dark" href="/auth?intent=payee">Review an agreement</Link>
            </div>
            <p className="fine-print">Committed funding never counts as cash until it arrives.</p>
          </div>
          <div className="hero-progress" aria-hidden="true">
            <span>01</span><span className="progress-line"><i /></span><span>04</span>
          </div>
        </section>



        <section id="how-it-works" className="process section-shell" aria-labelledby="process-heading">
          <div className="section-intro"><p className="eyebrow">How Pact works</p><h2 id="process-heading">Turn your event budget into a live funding plan.</h2><p>Connect expected funding to real vendor milestones, then track each amount from commitment to payment.</p></div>
          <div className="process-flow">
            <article className="process-step process-side">
              <div className="process-card-top"><span className="process-label">01 · Plan</span><span className="process-arrow"><ArrowUpRight aria-hidden="true" /></span></div>
              <h3>Model where money comes from and where it must go.</h3>
              <p>Add funding sources, vendor obligations, milestone amounts, and due dates without treating commitments as cash.</p>
              <div className="process-image process-image-bottom"><Image src="/how-plan.png" alt="An event organizer and venue manager reviewing the event plan" fill sizes="(max-width: 960px) 100vw, 33vw" /></div>
            </article>
            <article className="process-step process-featured">
              <div className="process-image process-image-shape"><Image src="/how-fund.png" alt="A sponsor and event producer reviewing a funding plan" fill sizes="(max-width: 960px) 100vw, 33vw" /></div>
              <div className="process-featured-copy">
                <div className="process-card-top"><span className="process-label">02 · Fund</span><span className="process-arrow"><ArrowUpRight aria-hidden="true" /></span></div>
                <h3>Let sponsors fund the event, not the blockchain.</h3>
                <p>Share a funding link for the event or a specific milestone. Pact handles the payment in the background.</p>
              </div>
            </article>
            <article className="process-step process-side">
              <div className="process-card-top"><span className="process-label">03 · Pay</span><span className="process-arrow"><ArrowUpRight aria-hidden="true" /></span></div>
              <h3>Allocate received funds before you release payment.</h3>
              <p>Fund each milestone, approve vendor payouts, and keep a clear record of payments and eligible refunds.</p>
              <div className="process-image process-image-bottom"><Image src="/how-pay.png" alt="An event production vendor confirming a payment beside the stage" fill sizes="(max-width: 960px) 100vw, 33vw" /></div>
            </article>
          </div>
        </section>

        <PactDemo />

        <PeopleSection />

        <section className="closing section-shell" aria-labelledby="closing-heading"><div><p className="eyebrow">See the financial state</p><h2 id="closing-heading">Find the funding gap before it becomes a crisis.</h2><p>Track every commitment, milestone, allocation, payment, and eligible refund in one place.</p></div><div className="closing-actions"><Link className="text-link" href="/auth?intent=payee">Vendor sign in <ArrowUpRight aria-hidden="true" /></Link><Link className="button button-primary" href="/auth?intent=organizer">Create an event Pact <ArrowUpRight aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="site-footer section-shell"><a className="wordmark" href="#top" aria-label="Pact home"><Image className="brand-logo" src="/pact-primary-logo.svg" alt="Pact" width={132} height={40} /></a><p>Financial infrastructure for the money behind an event.</p><span>© 2026 Pact</span></footer>
    </>
  );
}
