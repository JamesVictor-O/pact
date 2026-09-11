"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PaymentVisual, TIMING } from "./illustrations";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleCheck,
  FileText,
  MoveRight,
  RotateCcw,
  Send,
  ShoppingBag,
} from "lucide-react";

const routes = ["USDC on Base", "ETH on Ethereum", "SOL on Solana"];
const steps = [
  {
    title: "Make it a link.",
    body: "Set an amount and what you’re selling. Your settlement preference stays the same.",
    icon: FileText,
    color: "butter",
  },
  {
    title: "Share it anywhere.",
    body: "A message, an invoice, or a QR code at your counter. Your checkout goes where you do.",
    icon: Send,
    color: "peach",
  },
  {
    title: "Get paid your way.",
    body: "The buyer chooses a supported route. You receive your selected stablecoin on Monad.",
    icon: CheckCheck,
    color: "mint",
  },
];

export default function Home() {
  const reduced = useReducedMotion();
  const [route, setRoute] = useState(routes[0]);
  const [stage, setStage] = useState(0);
  const labels = [
    "Preview payment",
    "Preview verification",
    "Show merchant receipt",
  ];
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="header wrap">
        <a className="wordmark" href="#" aria-label="Morva home">
          <span className="mark" aria-hidden="true">
            m
          </span>
          morva
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#two-sides">For everyone</a>
        </nav>
        <a className="button small outline" href="#demo">
          Explore the demo <ArrowUpRight />
        </a>
      </header>
      <main id="main">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-dot" /> Payments, made shareable
            </span>
            <h1 id="hero-title">
              A payment link.
              <br />
              More ways to pay.
            </h1>
            <p>
              Sell something good. Share one link.
              <br className="desktop-break" /> Let your customer pay with what
              they have, while you receive the stablecoin you choose.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#demo">
                Try the checkout <ArrowRight />
              </a>
              <a className="text-link" href="#how-it-works">
                See how it works <MoveRight />
              </a>
            </div>
            <p className="fine-print">Built for the way you already sell.</p>
          </div>
          <motion.div
            className="hero-art"
            aria-label="Illustrative payment link for a studio order"
            initial={false}
            animate={{ y: reduced ? 0 : [18, 0], opacity: [0.7, 1] }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 110, damping: 20 }
            }
          >
            <PaymentVisual kind="settlement" />
          </motion.div>
        </section>
        <div className="principles wrap">
          <span>A checkout that travels with you</span>
          <div>
            <span>
              <Check /> No code to integrate
            </span>
            <span>
              <Check /> Direct to your wallet
            </span>
            <span>
              <Check /> One clear amount
            </span>
          </div>
        </div>
        <section
          className="section wrap"
          id="demo"
          aria-labelledby="demo-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">A little less explaining</span>
              <h2 id="demo-title">Meet your next checkout.</h2>
            </div>
            <p>
              One experience for your customer.
              <br />
              One currency that works for you.
            </p>
          </div>
          <div className="demo-layout">
            <div className="demo-context">
              <span className="pill">Interactive demo</span>
              <h3>
                Different wallets.
                <br />
                Same “thank you.”
              </h3>
              <PaymentVisual kind="route" />
              <p>
                Take a look from your customer’s side. Choose an example payment
                route and follow it through to the receipt.
              </p>
              <div className="demo-notice">
                <span className="tiny-dot" /> A preview, with no funds involved.
              </div>
              <div className="demo-footnote">
                Example assets only. Available routes depend on live liquidity.
                No wallet connection required for this demo.
              </div>
            </div>
            <motion.div
              className="checkout"
              initial={false}
              animate={{
                opacity: reduced ? 1 : [0.65, 1],
                y: reduced ? 0 : [5, 0],
              }}
              transition={{ duration: reduced ? 0 : TIMING.update }}
            >
              <div className="checkout-heading">
                <span className="wordmark compact">morva</span>
                <span className="pill">Checkout preview</span>
              </div>
              <div className="order">
                <span className="store-avatar peach">
                  <ShoppingBag />
                </span>
                <div>
                  Studio Forma<small>Ceramic mug · One piece</small>
                </div>
              </div>
              <div className="amount">
                25.00 <span>USDC</span>
              </div>
              <p className="amount-caption">Merchant receives on Monad</p>
              <div className="checkout-content">
                {stage === 0 ? (
                  <>
                    <label htmlFor="route">Pay with</label>
                    <select
                      id="route"
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                    >
                      {routes.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <p className="route-note">Example route · No live quote</p>
                  </>
                ) : (
                  <motion.div
                    className="simulation"
                    role="status"
                    key={stage}
                    initial={reduced ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : TIMING.update }}
                  >
                    <CircleCheck />
                    <div>
                      <strong>
                        {stage === 1
                          ? "Payment submitted · Simulated"
                          : stage === 2
                            ? "Transfer verified · Simulated"
                            : "Merchant received 25.00 USDC · Simulated"}
                      </strong>
                      <p>
                        {stage === 1
                          ? `Example funding: ${route}. In the real flow, settlement must be independently verified.`
                          : stage === 2
                            ? "The backend would check the recipient, token, amount and transaction before marking this link paid."
                            : "You’ve reached the end of the preview. No transfer occurred and no payment was recorded."}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
              {stage < 3 ? (
                <button
                  className="button dark full"
                  onClick={() => setStage((s) => s + 1)}
                >
                  {labels[stage]} <ArrowRight />
                </button>
              ) : (
                <button
                  className="button dark full"
                  onClick={() => setStage(0)}
                >
                  Try another route <RotateCcw />
                </button>
              )}
              <div className="checkout-footer">
                <span>Preview step {Math.min(stage + 1, 4)} of 4</span>
                {stage > 0 && stage < 3 && (
                  <button className="reset" onClick={() => setStage(0)}>
                    Start over
                  </button>
                )}
                <span>No real payment</span>
              </div>
            </motion.div>
          </div>
        </section>
        <section
          className="section wrap"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">From your counter to their screen</span>
              <h2 id="how-title">Three steps. Then back to business.</h2>
            </div>
            <span className="section-aside">Less setup. More selling.</span>
          </div>
          <div className="steps">
            {steps.map(({ title, body, icon: Icon, color }, i) => (
              <article className="step" key={title}>
                <PaymentVisual
                  kind={i === 0 ? "link" : i === 1 ? "share" : "verification"}
                />
                <div className="step-top">
                  <span className={`icon-tile ${color}`}>
                    <Icon />
                  </span>
                  <span className="step-number">0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <p className="verification-note">
            <CheckCheck /> A link is marked paid only after independent on-chain
            verification.
          </p>
        </section>
        <section
          className="section wrap sides-section"
          id="two-sides"
          aria-labelledby="sides-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Made for both of you</span>
              <h2 id="sides-title">Two sides, one rail.</h2>
            </div>
            <p>
              You agree on the price.
              <br />
              Morva handles the payment path.
            </p>
          </div>
          <div className="sides">
            <article className="side mint">
              <PaymentVisual kind="merchant" />
              <span className="pill">For merchants</span>
              <h3>
                Your business.
                <br />
                Your preferred stablecoin.
              </h3>
              <p>
                From the first DM to the last sale of the day. Share your link
                and keep payments in one place.
              </p>
              <ul>
                <li>
                  <Check /> Fixed amounts, clear expectations
                </li>
                <li>
                  <Check /> Settlement straight to your wallet
                </li>
                <li>
                  <Check /> Pending, paid, or expired at a glance
                </li>
              </ul>
              <div className="side-bottom">
                <span>Made for selling, anywhere.</span>
                <ShoppingBag />
              </div>
            </article>
            <article className="side lilac">
              <PaymentVisual kind="buyer" />
              <span className="pill">For buyers</span>
              <h3>
                Found something you love?
                <br />
                Pay with what you have.
              </h3>
              <p>
                Open the link, see the amount, and choose an available route
                from a supported chain and asset.
              </p>
              <ul>
                <li>
                  <Check /> See the checkout before signing in
                </li>
                <li>
                  <Check /> Sign in when you’re ready to pay
                </li>
                <li>
                  <Check /> A clear confirmation after verification
                </li>
              </ul>
              <div className="side-bottom">
                <span>Made for getting on with your day.</span>
                <ArrowUpRight />
              </div>
            </article>
          </div>
        </section>
        <div className="closing wrap">
          <span className="wordmark">One link. Business as usual.</span>
          <a className="button outline" href="#demo">
            Take a closer look <ArrowUpRight />
          </a>
        </div>
      </main>
      <footer className="footer wrap">
        <a href="#" className="wordmark compact">
          morva
        </a>
        <span>Payment links, with more ways to pay.</span>
        <span>Product preview · Payments are not live</span>
      </footer>
    </>
  );
}
