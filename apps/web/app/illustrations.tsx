"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

/* Product visual storyboard:
 *   0ms  payment terms and controls are visible
 *  80ms  secondary preview settles into position
 * 150ms  checkout state transition completes
 */
export const TIMING = { scene: 0.08, detail: 0.2, update: 0.15 };
type Kind =
  | "settlement"
  | "link"
  | "share"
  | "verification"
  | "merchant"
  | "buyer"
  | "route";

export function PaymentVisual({
  kind,
  className = "",
}: {
  kind: Kind;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`payment-visual visual-${kind} ${className}`}
      initial={false}
      whileInView={{
        opacity: reduced ? 1 : [0.7, 1],
        y: reduced ? 0 : [12, 0],
      }}
      viewport={{ once: true, amount: 0.25 }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 160, damping: 24, delay: TIMING.scene }
      }
    >
      <div className="visual-caption">
        <span>
          {kind === "settlement"
            ? "One payment. End to end."
            : kind === "merchant"
              ? "Payment activity"
              : kind === "buyer"
                ? "Your checkout"
                : kind === "route"
                  ? "Example funding route"
                  : "Product preview"}
        </span>
        <span className="preview-label">Preview</span>
      </div>
      {kind === "settlement" && (
        <>
          <div className="visual-panel">
            <div className="visual-row">
              <span>Payment request</span>
              <span className="visual-id">#1042</span>
            </div>
            <div className="visual-amount">
              25.00 <span>USDC</span>
            </div>
            <div className="visual-row muted">
              <span>Merchant settlement</span>
              <span>Monad</span>
            </div>
          </div>
          <div className="visual-connector">
            <ArrowDown aria-hidden="true" />
            <span>Buyer chooses a funding route</span>
          </div>
          <div className="funding-row">
            <span>USDC on Base</span>
            <ArrowRight aria-hidden="true" />
            <span>25.00 USDC on Monad</span>
          </div>
          <div className="visual-connector">
            <ArrowDown aria-hidden="true" />
            <span>Independent transfer verification</span>
          </div>
          <div className="verification-receipt">
            <div>
              <Check aria-hidden="true" />
              <strong>Merchant receipt</strong>
            </div>
            <div className="visual-row">
              <span>Link marked paid</span>
              <strong>25.00 USDC</strong>
            </div>
            <small>Illustrative outcome. No real transfer.</small>
          </div>
        </>
      )}
      {kind === "link" && (
        <div className="visual-panel">
          <div className="visual-row">
            <span>New payment link</span>
            <span>#1042</span>
          </div>
          <div className="visual-amount">
            25.00 <span>USDC</span>
          </div>
          <div className="visual-row muted">
            <span>Settlement</span>
            <span>Monad</span>
          </div>
          <div className="visual-row muted">
            <span>Expires after</span>
            <span>24 hours</span>
          </div>
        </div>
      )}
      {kind === "share" && (
        <div className="visual-panel">
          <span className="muted">Payment link</span>
          <div className="sample-url">morva.link/pay/example</div>
          <div className="share-channels">
            <span>Message</span>
            <span>Invoice</span>
            <span>QR code</span>
          </div>
          <p className="visual-note">
            The same fixed amount, wherever you share it.
          </p>
        </div>
      )}
      {kind === "verification" && (
        <div className="visual-panel">
          <strong>Before a link is marked paid</strong>
          <ul className="verification-list">
            {[
              "Recipient matches",
              "Token and amount match",
              "Transaction not used before",
            ].map((label) => (
              <li key={label}>
                <Check aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <div className="verification-stamp">
            Independently checked via Envio
          </div>
        </div>
      )}
      {kind === "merchant" && (
        <div className="visual-panel">
          <div className="visual-row">
            <span>Example link</span>
            <span>Amount / status</span>
          </div>
          {[
            ["#1042", "25.00", "Paid"],
            ["#1041", "40.00", "Pending"],
            ["#1040", "18.00", "Expired"],
          ].map(([id, amount, status]) => (
            <div className="activity-row" key={id}>
              <span>{id}</span>
              <strong>
                {amount} <small>USDC</small>
              </strong>
              <span
                className={status === "Paid" ? "status-paid" : "status-neutral"}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      )}
      {kind === "buyer" && (
        <div className="visual-panel">
          <div className="visual-row">
            <span>Amount due</span>
            <strong>25.00 USDC</strong>
          </div>
          <div className="buyer-choice">
            <span>Example source</span>
            <strong>USDC on Base</strong>
          </div>
          <div className="visual-row muted">
            <span>Merchant receives</span>
            <span>USDC on Monad</span>
          </div>
          <p className="visual-note">
            Review an available route before authorizing.
          </p>
        </div>
      )}
      {kind === "route" && (
        <>
          <div className="route-endpoint">
            <span>Buyer funds with</span>
            <strong>USDC on Base</strong>
          </div>
          <div className="visual-connector">
            <ArrowDown aria-hidden="true" />
            <span>Aurora Intents</span>
          </div>
          <div className="route-endpoint">
            <span>Merchant receives</span>
            <strong>USDC on Monad</strong>
          </div>
          <p className="visual-note">
            Example only. Availability depends on a live quote.
          </p>
        </>
      )}
    </motion.div>
  );
}
